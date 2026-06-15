import { BadRequestException, Injectable } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import { FlwMessageDto, FlwSessionDto } from '../domain/messaging-types'
import { FlwChatApiClient } from '../infrastructure/flw-chat-api.client'
import { PrismaFlwRawRepository } from '../infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'
import { MessagingNormalizationService } from './messaging-normalization.service'

const DEFAULT_PAGE_SIZE = 100
const RAW_SOURCE = 'api_sync'

export type FlwMessagingSyncResult = {
  clientId: string
  sessionsFetched: number
  messagesFetched: number
  sessionsWritten: number
  messagesWritten: number
  lastSessionSyncAt: string | null
  lastMessageSyncAt: string | null
}

@Injectable()
export class FlwMessagingSyncService {
  constructor(
    private readonly rawRepository: PrismaFlwRawRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
    private readonly normalizationService: MessagingNormalizationService,
  ) {}

  async syncClient(clientId: string): Promise<FlwMessagingSyncResult> {
    if (clientId.trim() === '') {
      throw new BadRequestException('clientId is required')
    }

    const env = loadEnv(process.env)

    if (env.FLW_CHAT_API_TOKEN === '') {
      throw new BadRequestException('FLW_CHAT_API_TOKEN is not configured')
    }

    const client = new FlwChatApiClient({
      chatBaseUrl: env.FLW_CHAT_API_BASE_URL,
      token: env.FLW_CHAT_API_TOKEN,
    })

    const syncState = await this.canonicalRepository.getOrCreateSyncState(clientId)
    const createdAtAfter = syncState.lastSessionSyncAt?.toISOString()

    let sessionsFetched = 0
    let messagesFetched = 0
    let latestSessionAt: Date | null = syncState.lastSessionSyncAt
    let latestMessageAt: Date | null = syncState.lastMessageSyncAt

    try {
      let pageNumber = 1
      let hasMorePages = true

      while (hasMorePages) {
        const page = await client.listSessions({
          pageNumber,
          pageSize: DEFAULT_PAGE_SIZE,
          createdAtAfter,
        })

        for (const session of page.items) {
          const sessionDto = toSessionDto(session)
          await this.rawRepository.upsertSession({
            clientId,
            session: sessionDto,
            source: RAW_SOURCE,
          })
          sessionsFetched += 1
          latestSessionAt = maxDate(latestSessionAt, new Date(sessionDto.startAt))

          const messageCount = await this.syncSessionMessages(client, clientId, sessionDto.id)
          messagesFetched += messageCount.messageCount

          if (messageCount.latestMessageAt != null) {
            latestMessageAt = maxDate(latestMessageAt, messageCount.latestMessageAt)
          }
        }

        hasMorePages = page.hasMorePages
        pageNumber += 1
      }

      const normalized = await this.normalizationService.normalizeClient(clientId)

      await this.canonicalRepository.updateSyncState({
        clientId,
        lastSessionSyncAt: latestSessionAt,
        lastMessageSyncAt: latestMessageAt,
        lastSuccessAt: new Date(),
        lastError: null,
      })

      return {
        clientId,
        sessionsFetched,
        messagesFetched,
        sessionsWritten: normalized.sessionsWritten,
        messagesWritten: normalized.messagesWritten,
        lastSessionSyncAt: latestSessionAt?.toISOString() ?? null,
        lastMessageSyncAt: latestMessageAt?.toISOString() ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown FLW sync error'

      await this.canonicalRepository.updateSyncState({
        clientId,
        lastError: message,
      })

      throw error
    }
  }

  private async syncSessionMessages(
    client: FlwChatApiClient,
    clientId: string,
    sessionId: string,
  ): Promise<{ messageCount: number; latestMessageAt: Date | null }> {
    let pageNumber = 1
    let hasMorePages = true
    let messageCount = 0
    let latestMessageAt: Date | null = null

    while (hasMorePages) {
      const page = await client.listSessionMessages(sessionId, {
        pageNumber,
        pageSize: DEFAULT_PAGE_SIZE,
      })

      for (const message of page.items) {
        const messageDto = toMessageDto(message)
        await this.rawRepository.upsertMessage({
          clientId,
          message: messageDto,
          source: RAW_SOURCE,
        })
        messageCount += 1
        latestMessageAt = maxDate(latestMessageAt, new Date(messageDto.createdAt))
      }

      hasMorePages = page.hasMorePages
      pageNumber += 1
    }

    return { messageCount, latestMessageAt }
  }
}

function toSessionDto(session: {
  id: string
  startAt: string
  endAt: string | null
  contactId: string | null
  userId: string | null
  agentDetails?: { email?: string | null } | null
  status: string
  departmentId?: string | null
}): FlwSessionDto {
  return {
    id: session.id,
    startAt: session.startAt,
    endAt: session.endAt,
    contactId: session.contactId,
    userId: session.userId,
    agentDetails: session.agentDetails ?? null,
    status: session.status,
    departmentId: session.departmentId ?? null,
  }
}

function toMessageDto(message: {
  id: string
  sessionId: string
  direction: string
  origin: string
  type: string
  text: string | null
  userId: string | null
  createdAt: string
  updatedAt?: string
  details?: FlwMessageDto['details']
}): FlwMessageDto {
  return {
    id: message.id,
    sessionId: message.sessionId,
    direction: message.direction,
    origin: message.origin,
    type: message.type,
    text: message.text,
    userId: message.userId,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt ?? message.createdAt,
    details: message.details ?? null,
  }
}

function maxDate(current: Date | null, candidate: Date): Date {
  if (current == null || candidate.getTime() > current.getTime()) {
    return candidate
  }

  return current
}
