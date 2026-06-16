import { Injectable } from '@nestjs/common'
import { FlwMessageDto, FlwSessionDto } from '../domain/messaging-types'
import { PrismaFlwRawRepository } from '../infrastructure/prisma-flw-raw.repository'
import {
  logFlwWebhookFailed,
  logFlwWebhookIgnored,
  logFlwWebhookNoExtractableContent,
  logFlwWebhookNormalized,
  logFlwWebhookStoredMessage,
  logFlwWebhookStoredSession,
} from './flw-webhook.logger'
import {
  extractFlwWebhookContent,
  isFlwMessageContent,
  isFlwSessionContent,
  resolveFlwWebhookEventType,
} from './flw-webhook-payload'
import { MessagingNormalizationService } from './messaging-normalization.service'

const WEBHOOK_SOURCE = 'webhook'

const SUPPORTED_EVENTS = new Set([
  'SESSION_NEW',
  'SESSION_UPDATE',
  'SESSION_COMPLETE',
  'MESSAGE_RECEIVED',
  'MESSAGE_SENT',
  'MESSAGE_UPDATED',
])

export type FlwWebhookIngestResult = {
  accepted: boolean
  event: string
  normalizedSessions: number
  normalizedMessages: number
}

@Injectable()
export class FlwWebhookIngestService {
  constructor(
    private readonly rawRepository: PrismaFlwRawRepository,
    private readonly normalizationService: MessagingNormalizationService,
  ) {}

  async ingest(input: {
    clientId: string
    payload: Record<string, unknown>
  }): Promise<FlwWebhookIngestResult> {
    const event = resolveFlwWebhookEventType(input.payload)

    if (!SUPPORTED_EVENTS.has(event)) {
      logFlwWebhookIgnored({ clientId: input.clientId, event })

      return {
        accepted: false,
        event,
        normalizedSessions: 0,
        normalizedMessages: 0,
      }
    }

    try {
      const session = extractSession(input.payload, event)
      const message = extractMessage(input.payload, event)

      if (session != null) {
        await this.rawRepository.upsertSession({
          clientId: input.clientId,
          session,
          source: WEBHOOK_SOURCE,
        })
        logFlwWebhookStoredSession({
          clientId: input.clientId,
          event,
          sessionId: session.id,
        })
      }

      if (message != null) {
        await this.rawRepository.upsertMessage({
          clientId: input.clientId,
          message,
          source: WEBHOOK_SOURCE,
        })
        logFlwWebhookStoredMessage({
          clientId: input.clientId,
          event,
          messageId: message.id,
          sessionId: message.sessionId,
        })
      }

      if (session == null && message == null) {
        logFlwWebhookNoExtractableContent({ clientId: input.clientId, event })
      }

      const normalized = await this.normalizationService.normalizeClient(input.clientId)

      logFlwWebhookNormalized({
        clientId: input.clientId,
        event,
        normalizedSessions: normalized.sessionsWritten,
        normalizedMessages: normalized.messagesWritten,
      })

      return {
        accepted: true,
        event,
        normalizedSessions: normalized.sessionsWritten,
        normalizedMessages: normalized.messagesWritten,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown FLW webhook error'

      logFlwWebhookFailed({
        clientId: input.clientId,
        event,
        error: message,
      })

      throw error
    }
  }
}

function extractSession(
  payload: Record<string, unknown>,
  event: string,
): FlwSessionDto | null {
  const content = extractFlwWebhookContent(payload)
  const nestedSession = payload.session

  const candidate =
    (nestedSession != null && typeof nestedSession === 'object'
      ? (nestedSession as Record<string, unknown>)
      : null) ??
    (event.startsWith('SESSION_') && isFlwSessionContent(content) ? content : null) ??
    (isFlwSessionContent(content) ? content : null)

  if (candidate == null || !isFlwSessionContent(candidate)) {
    return null
  }

  return mapSession(candidate)
}

function extractMessage(
  payload: Record<string, unknown>,
  event: string,
): FlwMessageDto | null {
  const content = extractFlwWebhookContent(payload)
  const nestedMessage = payload.message

  const candidate =
    (nestedMessage != null && typeof nestedMessage === 'object'
      ? (nestedMessage as Record<string, unknown>)
      : null) ??
    (event.startsWith('MESSAGE_') && isFlwMessageContent(content) ? content : null) ??
    (isFlwMessageContent(content) ? content : null)

  if (candidate == null || !isFlwMessageContent(candidate)) {
    return null
  }

  return mapMessage(candidate)
}

function mapSession(candidate: Record<string, unknown>): FlwSessionDto {
  return {
    id: candidate.id as string,
    startAt: candidate.startAt as string,
    endAt: typeof candidate.endAt === 'string' ? candidate.endAt : null,
    contactId: typeof candidate.contactId === 'string' ? candidate.contactId : null,
    userId: typeof candidate.userId === 'string' ? candidate.userId : null,
    agentDetails:
      candidate.agentDetails && typeof candidate.agentDetails === 'object'
        ? (candidate.agentDetails as FlwSessionDto['agentDetails'])
        : null,
    status: typeof candidate.status === 'string' ? candidate.status : 'UNDEFINED',
    departmentId: typeof candidate.departmentId === 'string' ? candidate.departmentId : null,
  }
}

function mapMessage(candidate: Record<string, unknown>): FlwMessageDto {
  return {
    id: candidate.id as string,
    sessionId: candidate.sessionId as string,
    direction: typeof candidate.direction === 'string' ? candidate.direction : 'TO_HUB',
    origin: typeof candidate.origin === 'string' ? candidate.origin : 'DEFAULT',
    type: typeof candidate.type === 'string' ? candidate.type : 'TEXT',
    text: typeof candidate.text === 'string' ? candidate.text : null,
    userId: typeof candidate.userId === 'string' ? candidate.userId : null,
    createdAt: candidate.createdAt as string,
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : String(candidate.createdAt),
    details:
      candidate.details && typeof candidate.details === 'object'
        ? (candidate.details as FlwMessageDto['details'])
        : null,
  }
}
