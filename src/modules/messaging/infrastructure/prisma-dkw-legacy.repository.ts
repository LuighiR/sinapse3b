import { Injectable } from '@nestjs/common'
import {
  DkwLegacyMessageSnapshot,
  DkwLegacySessionSnapshot,
} from '../domain/messaging-types'
import { PrismaService } from '../../../infra/prisma/prisma.service'

export type DkwLegacyMigrationPeriod = {
  from: Date
  toExclusive: Date
}

@Injectable()
export class PrismaDkwLegacyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSessionsStartedInPeriod(
    clientId: string,
    period: DkwLegacyMigrationPeriod,
  ): Promise<DkwLegacySessionSnapshot[]> {
    const rows = await this.prisma.session.findMany({
      where: {
        ticket: {
          clientId,
        },
        startedAt: {
          gte: period.from,
          lt: period.toExclusive,
        },
      },
      select: this.sessionSelect(),
      orderBy: {
        startedAt: 'asc',
      },
    })

    return rows.map((row) => this.mapSessionRow(row))
  }

  async listSessionsByIds(
    clientId: string,
    sessionIds: string[],
  ): Promise<DkwLegacySessionSnapshot[]> {
    if (sessionIds.length === 0) {
      return []
    }

    const rows = await this.prisma.session.findMany({
      where: {
        id: {
          in: sessionIds,
        },
        ticket: {
          clientId,
        },
      },
      select: this.sessionSelect(),
    })

    return rows.map((row) => this.mapSessionRow(row))
  }

  async countMessagesInPeriod(
    clientId: string,
    period: DkwLegacyMigrationPeriod,
  ): Promise<number> {
    return this.prisma.message.count({
      where: this.messagePeriodWhere(clientId, period),
    })
  }

  async listMessagesInPeriodBatch(input: {
    clientId: string
    period: DkwLegacyMigrationPeriod
    batchSize: number
    cursor?: string
  }): Promise<{ items: DkwLegacyMessageSnapshot[]; nextCursor: string | null }> {
    const rows = await this.prisma.message.findMany({
      where: this.messagePeriodWhere(input.clientId, input.period, input.cursor),
      select: {
        id: true,
        ticketId: true,
        sessionId: true,
        externalMessageId: true,
        body: true,
        fromMe: true,
        mediaUrl: true,
        mediaType: true,
        createdAtExternal: true,
        updatedAtExternal: true,
        senderType: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: input.batchSize,
    })

    const items = rows.map((row) => ({
      id: row.id,
      ticketId: row.ticketId,
      sessionId: row.sessionId,
      externalMessageId: row.externalMessageId,
      body: row.body,
      fromMe: row.fromMe,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      createdAtExternal: row.createdAtExternal,
      updatedAtExternal: row.updatedAtExternal,
      senderType: row.senderType,
      rawJson: null,
    }))

    const nextCursor = rows.length === input.batchSize ? rows[rows.length - 1]?.id ?? null : null

    return {
      items,
      nextCursor,
    }
  }

  private messagePeriodWhere(
    clientId: string,
    period: DkwLegacyMigrationPeriod,
    cursor?: string,
  ) {
    return {
      ticket: {
        clientId,
      },
      sessionId: {
        not: null,
      },
      createdAtExternal: {
        gte: period.from,
        lt: period.toExclusive,
      },
      ...(cursor != null
        ? {
            id: {
              gt: cursor,
            },
          }
        : {}),
    }
  }

  private sessionSelect() {
    return {
      id: true,
      ticketId: true,
      externalTrackingId: true,
      startedAt: true,
      endedAt: true,
      assignedUserName: true,
      assignedUserEmail: true,
      ticket: {
        select: {
          id: true,
          status: true,
          contactExternalId: true,
          contactNumber: true,
        },
      },
    }
  }

  private mapSessionRow(row: {
    id: string
    ticketId: string
    externalTrackingId: number | null
    startedAt: Date
    endedAt: Date | null
    assignedUserName: string | null
    assignedUserEmail: string | null
    ticket: {
      id: string
      status: string | null
      contactExternalId: number | null
      contactNumber: string | null
    }
  }): DkwLegacySessionSnapshot {
    return {
      id: row.id,
      ticketId: row.ticketId,
      externalTrackingId: row.externalTrackingId,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      assignedUserName: row.assignedUserName,
      assignedUserEmail: row.assignedUserEmail,
      ticket: row.ticket,
    }
  }
}
