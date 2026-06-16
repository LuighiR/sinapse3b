import {
  DkwLegacyMessageSnapshot,
  DkwLegacySessionSnapshot,
  MessagingDirectionValue,
  MessagingMessageWritePayload,
  MessagingSenderTypeValue,
  MessagingSessionWritePayload,
} from '../domain/messaging-types'

const DKW_PROVIDER = 'DKW' as const

export function buildDkwCanonicalMessagingSessionId(
  clientId: string,
  externalSessionId: string,
): string {
  return `${clientId}:DKW:${externalSessionId}`
}

export function buildDkwCanonicalMessagingMessageId(
  clientId: string,
  externalMessageId: string,
): string {
  return `${clientId}:DKW:${externalMessageId}`
}

export function resolveDkwExternalSessionId(session: DkwLegacySessionSnapshot): string {
  if (session.externalTrackingId != null) {
    return String(session.externalTrackingId)
  }

  return session.id
}

export function resolveDkwDirection(fromMe: boolean): MessagingDirectionValue {
  return fromMe ? 'OUTBOUND' : 'INBOUND'
}

export function mapDkwSenderType(
  senderType: DkwLegacyMessageSnapshot['senderType'],
): MessagingSenderTypeValue {
  return senderType
}

export function resolveDkwMessageType(mediaType: string | null): string {
  if (mediaType != null && mediaType.trim() !== '') {
    return mediaType
  }

  return 'TEXT'
}

function resolveDkwContactExternalId(session: DkwLegacySessionSnapshot): string | null {
  const ticket = session.ticket

  if (ticket?.contactExternalId != null) {
    return String(ticket.contactExternalId)
  }

  if (ticket?.contactNumber != null && ticket.contactNumber.trim() !== '') {
    return ticket.contactNumber.trim()
  }

  return null
}

export function mapDkwSessionToCanonical(input: {
  clientId: string
  session: DkwLegacySessionSnapshot
}): MessagingSessionWritePayload {
  const { clientId, session } = input
  const externalSessionId = resolveDkwExternalSessionId(session)

  return {
    id: buildDkwCanonicalMessagingSessionId(clientId, externalSessionId),
    clientId,
    branchId: null,
    provider: DKW_PROVIDER,
    externalSessionId,
    contactExternalId: resolveDkwContactExternalId(session),
    assignedAgentEmail: session.assignedUserEmail,
    assignedAgentUserId: null,
    status: session.ticket?.status ?? null,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    rawJson: session,
  }
}

export function mapDkwMessageToCanonical(input: {
  clientId: string
  sessionCanonicalId: string
  message: DkwLegacyMessageSnapshot
}): MessagingMessageWritePayload {
  const { clientId, sessionCanonicalId, message } = input

  return {
    id: buildDkwCanonicalMessagingMessageId(clientId, message.externalMessageId),
    clientId,
    sessionId: sessionCanonicalId,
    provider: DKW_PROVIDER,
    externalMessageId: message.externalMessageId,
    direction: resolveDkwDirection(message.fromMe),
    senderType: mapDkwSenderType(message.senderType),
    messageType: resolveDkwMessageType(message.mediaType),
    bodyText: message.body,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    createdAtExternal: message.createdAtExternal,
    updatedAtExternal: message.updatedAtExternal,
    rawJson: message.rawJson ?? message,
  }
}
