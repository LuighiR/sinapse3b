import {
  buildCanonicalMessagingMessageId,
  buildCanonicalMessagingSessionId,
  mapFlwMessageToCanonical,
  mapFlwSessionToCanonical,
  resolveDirection,
  resolveSenderType,
} from './flw-message-mapper'
import type { FlwMessageDto, FlwSessionDto } from '../domain/messaging-types'

const clientId = 'tenant-abc'
const sessionId = '11111111-1111-1111-1111-111111111111'
const messageId = '22222222-2222-2222-2222-222222222222'
const departmentId = '33333333-3333-3333-3333-333333333333'
const agentUserId = '44444444-4444-4444-4444-444444444444'

function baseSession(overrides: Partial<FlwSessionDto> = {}): FlwSessionDto {
  return {
    id: sessionId,
    startAt: '2026-01-15T08:00:00.000Z',
    endAt: '2026-01-15T09:30:00.000Z',
    contactId: '55555555-5555-5555-5555-555555555555',
    userId: agentUserId,
    agentDetails: { email: 'agent@example.com' },
    status: 'COMPLETED',
    departmentId,
    ...overrides,
  }
}

function baseMessage(overrides: Partial<FlwMessageDto> = {}): FlwMessageDto {
  return {
    id: messageId,
    sessionId,
    direction: 'TO_HUB',
    origin: 'DEFAULT',
    type: 'TEXT',
    text: 'Olá',
    userId: null,
    createdAt: '2026-01-15T08:05:00.000Z',
    updatedAt: '2026-01-15T08:05:00.000Z',
    details: null,
    ...overrides,
  }
}

describe('resolveDirection', () => {
  it('maps TO_HUB to INBOUND', () => {
    expect(resolveDirection('TO_HUB')).toBe('INBOUND')
  })

  it('maps FROM_HUB to OUTBOUND', () => {
    expect(resolveDirection('FROM_HUB')).toBe('OUTBOUND')
  })
})

describe('resolveSenderType', () => {
  it('maps origin BOT to BOT', () => {
    expect(resolveSenderType(baseMessage({ origin: 'BOT', direction: 'FROM_HUB' }))).toBe('BOT')
  })

  it('maps origin API to SYSTEM', () => {
    expect(resolveSenderType(baseMessage({ origin: 'API', direction: 'FROM_HUB' }))).toBe('SYSTEM')
  })

  it('maps outbound message with userId to HUMAN', () => {
    expect(
      resolveSenderType(
        baseMessage({
          direction: 'FROM_HUB',
          origin: 'DEFAULT',
          userId: agentUserId,
        }),
      ),
    ).toBe('HUMAN')
  })

  it('maps inbound contact message to HUMAN', () => {
    expect(
      resolveSenderType(
        baseMessage({
          direction: 'TO_HUB',
          origin: 'DEFAULT',
          userId: null,
        }),
      ),
    ).toBe('HUMAN')
  })
})

describe('mapFlwSessionToCanonical', () => {
  it('maps session fields and canonical id', () => {
    const session = baseSession()

    const result = mapFlwSessionToCanonical({ clientId, session })

    expect(result.id).toBe(buildCanonicalMessagingSessionId(clientId, sessionId))
    expect(result.clientId).toBe(clientId)
    expect(result.provider).toBe('FLW')
    expect(result.externalSessionId).toBe(sessionId)
    expect(result.contactExternalId).toBe(session.contactId)
    expect(result.assignedAgentEmail).toBe('agent@example.com')
    expect(result.assignedAgentUserId).toBe(agentUserId)
    expect(result.status).toBe('COMPLETED')
    expect(result.startedAt).toEqual(new Date('2026-01-15T08:00:00.000Z'))
    expect(result.endedAt).toEqual(new Date('2026-01-15T09:30:00.000Z'))
    expect(result.rawJson).toBe(session)
    expect(result.branchId).toBeNull()
  })

  it('resolves branch_id from departmentId lookup', () => {
    const branchIdByDepartmentId = new Map<string, number>([[departmentId, 42]])

    const result = mapFlwSessionToCanonical({
      clientId,
      session: baseSession(),
      branchIdByDepartmentId,
    })

    expect(result.branchId).toBe(42)
  })

  it('leaves branch_id null when department is not in lookup', () => {
    const branchIdByDepartmentId = new Map<string, number>([
      ['99999999-9999-9999-9999-999999999999', 7],
    ])

    const result = mapFlwSessionToCanonical({
      clientId,
      session: baseSession(),
      branchIdByDepartmentId,
    })

    expect(result.branchId).toBeNull()
  })
})

describe('mapFlwMessageToCanonical', () => {
  const sessionCanonicalId = buildCanonicalMessagingSessionId(clientId, sessionId)

  it('maps message fields and canonical id', () => {
    const message = baseMessage({
      direction: 'TO_HUB',
      text: 'Mensagem do cliente',
    })

    const result = mapFlwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message,
    })

    expect(result.id).toBe(buildCanonicalMessagingMessageId(clientId, messageId))
    expect(result.clientId).toBe(clientId)
    expect(result.sessionId).toBe(sessionCanonicalId)
    expect(result.provider).toBe('FLW')
    expect(result.externalMessageId).toBe(messageId)
    expect(result.direction).toBe('INBOUND')
    expect(result.senderType).toBe('HUMAN')
    expect(result.messageType).toBe('TEXT')
    expect(result.bodyText).toBe('Mensagem do cliente')
    expect(result.mediaUrl).toBeNull()
    expect(result.mediaType).toBe('TEXT')
    expect(result.createdAtExternal).toEqual(new Date('2026-01-15T08:05:00.000Z'))
    expect(result.updatedAtExternal).toEqual(new Date('2026-01-15T08:05:00.000Z'))
    expect(result.rawJson).toBe(message)
  })

  it('maps FROM_HUB to OUTBOUND', () => {
    const result = mapFlwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message: baseMessage({ direction: 'FROM_HUB', userId: agentUserId }),
    })

    expect(result.direction).toBe('OUTBOUND')
  })

  it('uses empty body_text when text is null', () => {
    const result = mapFlwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message: baseMessage({ text: null }),
    })

    expect(result.bodyText).toBe('')
  })

  it('maps details.file.publicUrl to media_url', () => {
    const message = baseMessage({
      type: 'IMAGE',
      text: null,
      details: {
        file: {
          publicUrl: 'https://cdn.example.com/file.jpg',
        },
      },
    })

    const result = mapFlwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message,
    })

    expect(result.mediaUrl).toBe('https://cdn.example.com/file.jpg')
    expect(result.mediaType).toBe('IMAGE')
  })
})
