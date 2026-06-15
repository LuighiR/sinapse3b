import { Injectable } from '@nestjs/common'
import { FlwMessageDto, FlwSessionDto } from '../domain/messaging-types'
import { PrismaFlwRawRepository } from '../infrastructure/prisma-flw-raw.repository'
import { MessagingNormalizationService } from './messaging-normalization.service'

const WEBHOOK_SOURCE = 'webhook'

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
    event: string
    payload: Record<string, unknown>
  }): Promise<FlwWebhookIngestResult> {
    const supportedEvents = new Set([
      'SESSION_NEW',
      'SESSION_UPDATE',
      'SESSION_COMPLETE',
      'MESSAGE_RECEIVED',
      'MESSAGE_SENT',
      'MESSAGE_UPDATED',
    ])

    if (!supportedEvents.has(input.event)) {
      return {
        accepted: false,
        event: input.event,
        normalizedSessions: 0,
        normalizedMessages: 0,
      }
    }

    const session = extractSession(input.payload)
    const message = extractMessage(input.payload)

    if (session != null) {
      await this.rawRepository.upsertSession({
        clientId: input.clientId,
        session,
        source: WEBHOOK_SOURCE,
      })
    }

    if (message != null) {
      await this.rawRepository.upsertMessage({
        clientId: input.clientId,
        message,
        source: WEBHOOK_SOURCE,
      })
    }

    const normalized = await this.normalizationService.normalizeClient(input.clientId)

    return {
      accepted: true,
      event: input.event,
      normalizedSessions: normalized.sessionsWritten,
      normalizedMessages: normalized.messagesWritten,
    }
  }
}

function extractSession(payload: Record<string, unknown>): FlwSessionDto | null {
  const candidate = (payload.session ?? payload.data ?? payload) as Record<string, unknown>

  if (typeof candidate.id !== 'string' || typeof candidate.startAt !== 'string') {
    return null
  }

  return {
    id: candidate.id,
    startAt: candidate.startAt,
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

function extractMessage(payload: Record<string, unknown>): FlwMessageDto | null {
  const candidate = (payload.message ?? payload.data ?? payload) as Record<string, unknown>

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.sessionId !== 'string' ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    sessionId: candidate.sessionId,
    direction: typeof candidate.direction === 'string' ? candidate.direction : 'TO_HUB',
    origin: typeof candidate.origin === 'string' ? candidate.origin : 'DEFAULT',
    type: typeof candidate.type === 'string' ? candidate.type : 'TEXT',
    text: typeof candidate.text === 'string' ? candidate.text : null,
    userId: typeof candidate.userId === 'string' ? candidate.userId : null,
    createdAt: candidate.createdAt,
    updatedAt:
      typeof candidate.updatedAt === 'string' ? candidate.updatedAt : String(candidate.createdAt),
    details:
      candidate.details && typeof candidate.details === 'object'
        ? (candidate.details as FlwMessageDto['details'])
        : null,
  }
}
