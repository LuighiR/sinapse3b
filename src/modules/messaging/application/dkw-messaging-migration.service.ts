import { Injectable } from '@nestjs/common'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import {
  mapDkwMessageToCanonical,
  mapDkwSessionToCanonical,
} from './dkw-legacy-message-mapper'
import {
  logDkwMigrationCompleted,
  logDkwMigrationStarted,
  logDkwMigrationWindowCompleted,
  logDkwMigrationWindowStarted,
} from './dkw-migration.logger'
import { splitPeriodIntoMonthlyWindows } from './dkw-migration-month-windows'
import {
  DkwLegacyMigrationPeriod,
  PrismaDkwLegacyRepository,
} from '../infrastructure/prisma-dkw-legacy.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'
import { MessagingContactService } from './messaging-contact.service'

export type DkwMessagingMigrationWindowResult = {
  from: string
  to: string
  sessionsRead: number
  sessionsWritten: number
  messagesExpected: number
  messagesRead: number
  messagesWritten: number
  messagesSkippedMissingSession: number
  batchesProcessed: number
}

export type DkwMessagingMigrationResult = {
  clientId: string
  from: string
  to: string
  batchSize: number
  windowsProcessed: number
  totals: {
    sessionsRead: number
    sessionsWritten: number
    messagesExpected: number
    messagesRead: number
    messagesWritten: number
    messagesSkippedMissingSession: number
    batchesProcessed: number
  }
  windows: DkwMessagingMigrationWindowResult[]
}

@Injectable()
export class DkwMessagingMigrationService {
  constructor(
    private readonly legacyRepository: PrismaDkwLegacyRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
    private readonly contactService: MessagingContactService,
  ) {}

  async migrateClient(input: {
    clientId: string
    period: KpiPeriod
    batchSize: number
  }): Promise<DkwMessagingMigrationResult> {
    const overallFrom = KpiPeriod.formatDateKey(input.period.from)
    const overallTo = KpiPeriod.formatDateKey(input.period.to)
    const monthlyWindows = splitPeriodIntoMonthlyWindows(input.period)

    logDkwMigrationStarted({
      clientId: input.clientId,
      from: overallFrom,
      to: overallTo,
      batchSize: input.batchSize,
      windowsTotal: monthlyWindows.length,
    })

    const windows: DkwMessagingMigrationWindowResult[] = []
    const totals = {
      sessionsRead: 0,
      sessionsWritten: 0,
      messagesExpected: 0,
      messagesRead: 0,
      messagesWritten: 0,
      messagesSkippedMissingSession: 0,
      batchesProcessed: 0,
    }

    for (const [index, windowPeriod] of monthlyWindows.entries()) {
      const windowFrom = KpiPeriod.formatDateKey(windowPeriod.from)
      const windowTo = KpiPeriod.formatDateKey(windowPeriod.to)

      logDkwMigrationWindowStarted({
        clientId: input.clientId,
        windowIndex: index + 1,
        windowsTotal: monthlyWindows.length,
        from: windowFrom,
        to: windowTo,
      })

      const windowResult = await this.migrateClientPeriod({
        clientId: input.clientId,
        period: windowPeriod,
        batchSize: input.batchSize,
      })

      windows.push(windowResult)
      totals.sessionsRead += windowResult.sessionsRead
      totals.sessionsWritten += windowResult.sessionsWritten
      totals.messagesExpected += windowResult.messagesExpected
      totals.messagesRead += windowResult.messagesRead
      totals.messagesWritten += windowResult.messagesWritten
      totals.messagesSkippedMissingSession += windowResult.messagesSkippedMissingSession
      totals.batchesProcessed += windowResult.batchesProcessed

      logDkwMigrationWindowCompleted({
        clientId: input.clientId,
        windowIndex: index + 1,
        windowsTotal: monthlyWindows.length,
        from: windowFrom,
        to: windowTo,
        messagesExpected: windowResult.messagesExpected,
        messagesWritten: windowResult.messagesWritten,
        messagesSkippedMissingSession: windowResult.messagesSkippedMissingSession,
        batchesProcessed: windowResult.batchesProcessed,
      })
    }

    logDkwMigrationCompleted({
      clientId: input.clientId,
      from: overallFrom,
      to: overallTo,
      windowsProcessed: windows.length,
      messagesWritten: totals.messagesWritten,
    })

    return {
      clientId: input.clientId,
      from: overallFrom,
      to: overallTo,
      batchSize: input.batchSize,
      windowsProcessed: windows.length,
      totals,
      windows,
    }
  }

  private async migrateClientPeriod(input: {
    clientId: string
    period: KpiPeriod
    batchSize: number
  }): Promise<DkwMessagingMigrationWindowResult> {
    const period = this.toLegacyMigrationPeriod(input.period)
    const sessionCanonicalIdByLegacySessionId = new Map<string, string>()

    const sessionsStartedInPeriod = await this.legacyRepository.listSessionsStartedInPeriod(
      input.clientId,
      period,
    )

    let sessionsWritten = 0
    let sessionsReferencedOutsidePeriod = 0

    for (const session of sessionsStartedInPeriod) {
      await this.upsertLegacySession(input.clientId, session, sessionCanonicalIdByLegacySessionId)
      sessionsWritten += 1
    }

    const messagesExpected = await this.legacyRepository.countMessagesInPeriod(
      input.clientId,
      period,
    )

    let messagesRead = 0
    let messagesWritten = 0
    let messagesSkippedMissingSession = 0
    let batchesProcessed = 0
    let cursor: string | undefined

    while (true) {
      const batch = await this.legacyRepository.listMessagesInPeriodBatch({
        clientId: input.clientId,
        period,
        batchSize: input.batchSize,
        cursor,
      })

      if (batch.items.length === 0) {
        break
      }

      batchesProcessed += 1
      messagesRead += batch.items.length

      const missingSessionIds = [
        ...new Set(
          batch.items
            .map((message) => message.sessionId)
            .filter(
              (sessionId): sessionId is string =>
                sessionId != null && !sessionCanonicalIdByLegacySessionId.has(sessionId),
            ),
        ),
      ]

      if (missingSessionIds.length > 0) {
        const referencedSessions = await this.legacyRepository.listSessionsByIds(
          input.clientId,
          missingSessionIds,
        )

        for (const session of referencedSessions) {
          if (sessionCanonicalIdByLegacySessionId.has(session.id)) {
            continue
          }

          await this.upsertLegacySession(input.clientId, session, sessionCanonicalIdByLegacySessionId)
          sessionsReferencedOutsidePeriod += 1
          sessionsWritten += 1
        }
      }

      for (const message of batch.items) {
        if (message.sessionId == null) {
          messagesSkippedMissingSession += 1
          continue
        }

        const sessionCanonicalId = sessionCanonicalIdByLegacySessionId.get(message.sessionId)

        if (sessionCanonicalId == null) {
          messagesSkippedMissingSession += 1
          continue
        }

        const payload = mapDkwMessageToCanonical({
          clientId: input.clientId,
          sessionCanonicalId,
          message,
        })

        await this.canonicalRepository.upsertMessage(payload)
        messagesWritten += 1
      }

      if (batch.nextCursor == null) {
        break
      }

      cursor = batch.nextCursor
    }

    return {
      from: KpiPeriod.formatDateKey(input.period.from),
      to: KpiPeriod.formatDateKey(input.period.to),
      sessionsRead: sessionsStartedInPeriod.length + sessionsReferencedOutsidePeriod,
      sessionsWritten,
      messagesExpected,
      messagesRead,
      messagesWritten,
      messagesSkippedMissingSession,
      batchesProcessed,
    }
  }

  private async upsertLegacySession(
    clientId: string,
    session: Parameters<typeof mapDkwSessionToCanonical>[0]['session'],
    sessionCanonicalIdByLegacySessionId: Map<string, string>,
  ): Promise<void> {
    const payload = mapDkwSessionToCanonical({ clientId, session })

    await this.contactService.upsertSessionWithContact(payload)
    sessionCanonicalIdByLegacySessionId.set(session.id, payload.id)
  }

  private toLegacyMigrationPeriod(period: KpiPeriod): DkwLegacyMigrationPeriod {
    const toExclusive = new Date(period.to.getTime())
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)

    return {
      from: period.from,
      toExclusive,
    }
  }
}
