import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import {
  MessagingMessageWritePayload,
  MessagingSessionWritePayload,
} from '../domain/messaging-types'

export type MessagingSyncStateRecord = {
  clientId: string
  provider: string
  lastSessionSyncAt: Date | null
  lastMessageSyncAt: Date | null
  lastSuccessAt: Date | null
  lastError: string | null
}

@Injectable()
export class PrismaMessagingCanonicalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateSyncState(clientId: string): Promise<MessagingSyncStateRecord> {
    const row = await this.prisma.messagingSyncState.upsert({
      where: { clientId },
      create: { clientId },
      update: {},
    })

    return row
  }

  async updateSyncState(input: {
    clientId: string
    lastSessionSyncAt?: Date | null
    lastMessageSyncAt?: Date | null
    lastSuccessAt?: Date | null
    lastError?: string | null
  }): Promise<void> {
    await this.prisma.messagingSyncState.update({
      where: { clientId: input.clientId },
      data: {
        lastSessionSyncAt: input.lastSessionSyncAt,
        lastMessageSyncAt: input.lastMessageSyncAt,
        lastSuccessAt: input.lastSuccessAt,
        lastError: input.lastError,
      },
    })
  }

  async loadBranchIdByDepartmentId(clientId: string): Promise<Map<string, number>> {
    const branches = await this.prisma.branch.findMany({
      where: {
        clientId,
        flwDepartmentId: { not: null },
      },
      select: {
        id: true,
        flwDepartmentId: true,
      },
    })

    const map = new Map<string, number>()

    for (const branch of branches) {
      if (branch.flwDepartmentId != null) {
        map.set(branch.flwDepartmentId, branch.id)
      }
    }

    return map
  }

  async upsertSession(payload: MessagingSessionWritePayload): Promise<void> {
    await this.prisma.messagingSession.upsert({
      where: {
        clientId_provider_externalSessionId: {
          clientId: payload.clientId,
          provider: payload.provider,
          externalSessionId: payload.externalSessionId,
        },
      },
      create: {
        id: payload.id,
        clientId: payload.clientId,
        branchId: payload.branchId,
        provider: payload.provider,
        externalSessionId: payload.externalSessionId,
        contactExternalId: payload.contactExternalId,
        assignedAgentEmail: payload.assignedAgentEmail,
        assignedAgentUserId: payload.assignedAgentUserId,
        status: payload.status,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
      update: {
        branchId: payload.branchId,
        contactExternalId: payload.contactExternalId,
        assignedAgentEmail: payload.assignedAgentEmail,
        assignedAgentUserId: payload.assignedAgentUserId,
        status: payload.status,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async upsertMessage(payload: MessagingMessageWritePayload): Promise<void> {
    await this.prisma.messagingMessage.upsert({
      where: {
        clientId_provider_externalMessageId: {
          clientId: payload.clientId,
          provider: payload.provider,
          externalMessageId: payload.externalMessageId,
        },
      },
      create: {
        id: payload.id,
        clientId: payload.clientId,
        sessionId: payload.sessionId,
        provider: payload.provider,
        externalMessageId: payload.externalMessageId,
        direction: payload.direction,
        senderType: payload.senderType,
        messageType: payload.messageType,
        bodyText: payload.bodyText,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        createdAtExternal: payload.createdAtExternal,
        updatedAtExternal: payload.updatedAtExternal,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
      update: {
        sessionId: payload.sessionId,
        direction: payload.direction,
        senderType: payload.senderType,
        messageType: payload.messageType,
        bodyText: payload.bodyText,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        createdAtExternal: payload.createdAtExternal,
        updatedAtExternal: payload.updatedAtExternal,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
    })
  }
}
