import {
  FlwMessageDto,
  FlwMessageDirection,
  FlwSessionDto,
  MessagingDirectionValue,
  MessagingMessageWritePayload,
  MessagingSenderTypeValue,
  MessagingSessionWritePayload,
} from '../domain/messaging-types'

const FLW_PROVIDER = 'FLW' as const

export function buildCanonicalMessagingSessionId(clientId: string, externalSessionId: string): string {
  return `${clientId}:FLW:${externalSessionId}`
}

export function buildCanonicalMessagingMessageId(clientId: string, externalMessageId: string): string {
  return `${clientId}:FLW:${externalMessageId}`
}

export function resolveDirection(direction: FlwMessageDirection): MessagingDirectionValue {
  if (direction === 'TO_HUB') {
    return 'INBOUND'
  }

  return 'OUTBOUND'
}

export function resolveSenderType(message: FlwMessageDto): MessagingSenderTypeValue {
  if (message.origin === 'BOT') {
    return 'BOT'
  }

  if (message.origin === 'API') {
    return 'SYSTEM'
  }

  if (message.userId != null) {
    return 'HUMAN'
  }

  return 'HUMAN'
}

export function mapFlwSessionToCanonical(input: {
  clientId: string
  session: FlwSessionDto
  branchIdByDepartmentId?: Map<string, number>
  cityByDepartmentId?: Map<string, string>
}): MessagingSessionWritePayload {
  const { clientId, session, branchIdByDepartmentId, cityByDepartmentId } = input
  const branchId =
    session.departmentId != null && branchIdByDepartmentId != null
      ? branchIdByDepartmentId.get(session.departmentId) ?? null
      : null
  const externalDepartmentId =
    typeof session.departmentId === 'string' ? session.departmentId : null
  const whatsappCityId =
    externalDepartmentId != null && cityByDepartmentId != null
      ? cityByDepartmentId.get(externalDepartmentId) ?? null
      : null

  return {
    id: buildCanonicalMessagingSessionId(clientId, session.id),
    clientId,
    branchId,
    provider: FLW_PROVIDER,
    externalSessionId: session.id,
    contactExternalId: session.contactId,
    assignedAgentEmail: session.agentDetails?.email ?? null,
    assignedAgentUserId: session.userId ?? null,
    status: session.status ?? null,
    startedAt: new Date(session.startAt),
    endedAt: session.endAt != null ? new Date(session.endAt) : null,
    whatsappCityId,
    externalDepartmentId,
    rawJson: session,
  }
}

export function mapFlwMessageToCanonical(input: {
  clientId: string
  sessionCanonicalId: string
  message: FlwMessageDto
}): MessagingMessageWritePayload {
  const { clientId, sessionCanonicalId, message } = input

  return {
    id: buildCanonicalMessagingMessageId(clientId, message.id),
    clientId,
    sessionId: sessionCanonicalId,
    provider: FLW_PROVIDER,
    externalMessageId: message.id,
    direction: resolveDirection(message.direction as FlwMessageDirection),
    senderType: resolveSenderType(message),
    messageType: message.type,
    bodyText: message.text ?? '',
    mediaUrl: message.details?.file?.publicUrl ?? null,
    mediaType: message.type,
    createdAtExternal: new Date(message.createdAt),
    updatedAtExternal: new Date(message.updatedAt),
    rawJson: message,
  }
}
