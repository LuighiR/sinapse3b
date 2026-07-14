import { randomUUID } from 'node:crypto'
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
  lastNormalizedAt: Date | null
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
    lastNormalizedAt?: Date | null
    lastSuccessAt?: Date | null
    lastError?: string | null
  }): Promise<void> {
    await this.prisma.messagingSyncState.update({
      where: { clientId: input.clientId },
      data: {
        lastSessionSyncAt: input.lastSessionSyncAt,
        lastMessageSyncAt: input.lastMessageSyncAt,
        lastNormalizedAt: input.lastNormalizedAt,
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

  async loadWhatsAppCityIdByDepartmentId(clientId: string): Promise<Map<string, string>> {
    const mappings = await this.prisma.whatsAppDepartmentMapping.findMany({
      where: {
        clientId,
        status: 'MAPPED',
        cityId: { not: null },
      },
      select: {
        departmentId: true,
        cityId: true,
      },
    })

    const map = new Map<string, string>()

    for (const mapping of mappings) {
      if (mapping.cityId != null) {
        map.set(mapping.departmentId, mapping.cityId)
      }
    }

    return map
  }

  async resolveWhatsAppCityForDepartment(input: {
    clientId: string
    departmentId: string
  }): Promise<string | null> {
    const existing = await this.prisma.whatsAppDepartmentMapping.findUnique({
      where: {
        clientId_departmentId: {
          clientId: input.clientId,
          departmentId: input.departmentId,
        },
      },
      select: {
        status: true,
        cityId: true,
      },
    })

    if (existing != null) {
      return existing.status === 'MAPPED' ? existing.cityId : null
    }

    try {
      await this.prisma.whatsAppDepartmentMapping.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          departmentId: input.departmentId,
          status: 'PENDING',
          cityId: null,
        },
      })
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error
      }
    }

    return null
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
        contactId: payload.contactId ?? null,
        assignedAgentEmail: payload.assignedAgentEmail,
        assignedAgentUserId: payload.assignedAgentUserId,
        status: payload.status,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        whatsappCityId: payload.whatsappCityId,
        externalDepartmentId: payload.externalDepartmentId,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
      update: {
        branchId: payload.branchId,
        contactExternalId: payload.contactExternalId,
        contactId: payload.contactId ?? null,
        assignedAgentEmail: payload.assignedAgentEmail,
        assignedAgentUserId: payload.assignedAgentUserId,
        status: payload.status,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        whatsappCityId: payload.whatsappCityId,
        externalDepartmentId: payload.externalDepartmentId,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async findSampleSessionByContactKey(input: {
    clientId: string
    provider: MessagingSessionWritePayload['provider']
    contactExternalId: string
  }): Promise<MessagingSessionWritePayload | null> {
    const row = await this.prisma.messagingSession.findFirst({
      where: {
        clientId: input.clientId,
        provider: input.provider,
        contactExternalId: input.contactExternalId,
      },
      orderBy: { startedAt: 'desc' },
    })

    if (row == null) {
      return null
    }

    return {
      id: row.id,
      clientId: row.clientId,
      branchId: row.branchId,
      provider: row.provider,
      externalSessionId: row.externalSessionId,
      contactExternalId: row.contactExternalId,
      contactId: row.contactId,
      assignedAgentEmail: row.assignedAgentEmail,
      assignedAgentUserId: row.assignedAgentUserId,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      whatsappCityId: row.whatsappCityId,
      externalDepartmentId: row.externalDepartmentId,
      rawJson: row.rawJson,
    }
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
