import {
  buildDkwCanonicalMessagingMessageId,
  buildDkwCanonicalMessagingSessionId,
  mapDkwMessageToCanonical,
  mapDkwSessionToCanonical,
  resolveDkwDirection,
  resolveDkwExternalSessionId,
  resolveDkwMessageType,
} from './dkw-legacy-message-mapper'
import type {
  DkwLegacyMessageSnapshot,
  DkwLegacySessionSnapshot,
} from '../domain/messaging-types'

const clientId = 'ferracosul'
const sessionId = 'session-legacy-1'
const externalTrackingId = 98765
const messageExternalId = 'msg-ext-123'

function baseSession(overrides: Partial<DkwLegacySessionSnapshot> = {}): DkwLegacySessionSnapshot {
  return {
    id: sessionId,
    ticketId: 'ticket-1',
    externalTrackingId,
    startedAt: new Date('2026-01-10T08:00:00.000Z'),
    endedAt: new Date('2026-01-10T09:00:00.000Z'),
    assignedUserName: 'Maria',
    assignedUserEmail: 'maria@empresa.com',
    ticket: {
      id: 'ticket-1',
      status: 'OPEN',
      contactExternalId: 555,
      contactNumber: '5511999999999',
    },
    ...overrides,
  }
}

function baseMessage(overrides: Partial<DkwLegacyMessageSnapshot> = {}): DkwLegacyMessageSnapshot {
  return {
    id: 'message-legacy-1',
    ticketId: 'ticket-1',
    sessionId,
    externalMessageId: messageExternalId,
    body: 'Olá, preciso de ajuda',
    fromMe: false,
    mediaUrl: null,
    mediaType: null,
    createdAtExternal: new Date('2026-01-10T08:05:00.000Z'),
    updatedAtExternal: new Date('2026-01-10T08:05:00.000Z'),
    senderType: 'HUMAN',
    rawJson: { legacy: true },
    ...overrides,
  }
}

describe('resolveDkwExternalSessionId', () => {
  it('prefers external_tracking_id when present', () => {
    expect(resolveDkwExternalSessionId(baseSession())).toBe(String(externalTrackingId))
  })

  it('falls back to session id when external_tracking_id is null', () => {
    expect(resolveDkwExternalSessionId(baseSession({ externalTrackingId: null }))).toBe(sessionId)
  })
})

describe('resolveDkwDirection', () => {
  it('maps from_me=false to INBOUND', () => {
    expect(resolveDkwDirection(false)).toBe('INBOUND')
  })

  it('maps from_me=true to OUTBOUND', () => {
    expect(resolveDkwDirection(true)).toBe('OUTBOUND')
  })
})

describe('resolveDkwMessageType', () => {
  it('returns TEXT when media_type is empty', () => {
    expect(resolveDkwMessageType(null)).toBe('TEXT')
  })

  it('returns media_type when present', () => {
    expect(resolveDkwMessageType('IMAGE')).toBe('IMAGE')
  })
})

describe('mapDkwSessionToCanonical', () => {
  it('maps session with provider DKW and assigned agent email', () => {
    const session = baseSession()
    const externalSessionId = String(externalTrackingId)

    const result = mapDkwSessionToCanonical({ clientId, session })

    expect(result.id).toBe(buildDkwCanonicalMessagingSessionId(clientId, externalSessionId))
    expect(result.provider).toBe('DKW')
    expect(result.externalSessionId).toBe(externalSessionId)
    expect(result.assignedAgentEmail).toBe('maria@empresa.com')
    expect(result.contactExternalId).toBe('555')
    expect(result.status).toBe('OPEN')
    expect(result.startedAt).toEqual(session.startedAt)
    expect(result.endedAt).toEqual(session.endedAt)
    expect(result.rawJson).toBe(session)
  })
})

describe('mapDkwMessageToCanonical', () => {
  const sessionCanonicalId = buildDkwCanonicalMessagingSessionId(clientId, String(externalTrackingId))

  it('preserves timestamps and sender_type', () => {
    const message = baseMessage()

    const result = mapDkwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message,
    })

    expect(result.id).toBe(buildDkwCanonicalMessagingMessageId(clientId, messageExternalId))
    expect(result.provider).toBe('DKW')
    expect(result.direction).toBe('INBOUND')
    expect(result.senderType).toBe('HUMAN')
    expect(result.createdAtExternal).toEqual(message.createdAtExternal)
    expect(result.updatedAtExternal).toEqual(message.updatedAtExternal)
    expect(result.bodyText).toBe('Olá, preciso de ajuda')
    expect(result.rawJson).toEqual({ legacy: true })
  })

  it('maps outbound messages from from_me=true', () => {
    const result = mapDkwMessageToCanonical({
      clientId,
      sessionCanonicalId,
      message: baseMessage({ fromMe: true, senderType: 'SYSTEM' }),
    })

    expect(result.direction).toBe('OUTBOUND')
    expect(result.senderType).toBe('SYSTEM')
  })
})
