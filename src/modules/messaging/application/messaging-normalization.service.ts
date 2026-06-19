import { Injectable } from '@nestjs/common'
import {
  buildCanonicalMessagingSessionId,
  mapFlwMessageToCanonical,
  mapFlwSessionToCanonical,
} from './flw-message-mapper'
import { MessagingContactService } from './messaging-contact.service'
import { PrismaFlwRawRepository } from '../infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'

export type MessagingNormalizationMode = 'incremental' | 'full'

export type MessagingNormalizationResult = {
  clientId: string
  mode: MessagingNormalizationMode
  since: string | null
  lastNormalizedAt: string
  sessionsRead: number
  sessionsWritten: number
  messagesRead: number
  messagesWritten: number
  messagesSkippedMissingSession: number
}

@Injectable()
export class MessagingNormalizationService {
  constructor(
    private readonly rawRepository: PrismaFlwRawRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
    private readonly contactService: MessagingContactService,
  ) {}

  async normalizeClient(input: {
    clientId: string
    full?: boolean
  }): Promise<MessagingNormalizationResult> {
    const { clientId } = input
    const full = input.full === true
    const startedAt = new Date()

    const syncState = await this.canonicalRepository.getOrCreateSyncState(clientId)
    const since = full ? null : syncState.lastNormalizedAt
    const mode: MessagingNormalizationMode = since == null ? 'full' : 'incremental'

    const branchIdByDepartmentId = await this.canonicalRepository.loadBranchIdByDepartmentId(clientId)
    const allSessions = await this.rawRepository.listSessionsByClientId(clientId)
    const sessionsToUpsert =
      since == null
        ? allSessions
        : await this.rawRepository.listSessionsByClientIdSince(clientId, since)
    const messagesToUpsert =
      since == null
        ? await this.rawRepository.listMessagesByClientId(clientId)
        : await this.rawRepository.listMessagesByClientIdSince(clientId, since)

    const sessionIdByExternalId = new Map<string, string>()

    for (const session of allSessions) {
      sessionIdByExternalId.set(session.id, buildCanonicalMessagingSessionId(clientId, session.id))
    }

    for (const session of sessionsToUpsert) {
      const payload = mapFlwSessionToCanonical({
        clientId,
        session,
        branchIdByDepartmentId,
      })

      await this.contactService.upsertSessionWithContact(payload)
    }

    let messagesWritten = 0
    let messagesSkippedMissingSession = 0

    for (const message of messagesToUpsert) {
      const sessionCanonicalId = sessionIdByExternalId.get(message.sessionId)

      if (sessionCanonicalId == null) {
        messagesSkippedMissingSession += 1
        continue
      }

      const payload = mapFlwMessageToCanonical({
        clientId,
        sessionCanonicalId,
        message,
      })

      await this.canonicalRepository.upsertMessage(payload)
      messagesWritten += 1
    }

    await this.canonicalRepository.updateSyncState({
      clientId,
      lastNormalizedAt: startedAt,
      lastSuccessAt: startedAt,
      lastError: null,
    })

    console.log(
      `[messaging-normalize] completed clientId=${clientId} mode=${mode} sessionsWritten=${sessionsToUpsert.length} messagesWritten=${messagesWritten} skippedMissingSession=${messagesSkippedMissingSession}`,
    )

    return {
      clientId,
      mode,
      since: since?.toISOString() ?? null,
      lastNormalizedAt: startedAt.toISOString(),
      sessionsRead: sessionsToUpsert.length,
      sessionsWritten: sessionsToUpsert.length,
      messagesRead: messagesToUpsert.length,
      messagesWritten,
      messagesSkippedMissingSession,
    }
  }
}
