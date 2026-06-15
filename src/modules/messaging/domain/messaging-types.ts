export type MessagingProviderValue = 'FLW' | 'DKW'

export type MessagingDirectionValue = 'INBOUND' | 'OUTBOUND'

export type MessagingSenderTypeValue = 'HUMAN' | 'SYSTEM' | 'AI' | 'BOT'

export type FlwMessageDirection = 'FROM_HUB' | 'TO_HUB'

export interface FlwAgentDetailsDto {
  email?: string | null
}

export interface FlwSessionDto {
  id: string
  startAt: string
  endAt: string | null
  contactId: string | null
  userId: string | null
  agentDetails?: FlwAgentDetailsDto | null
  status: string
  departmentId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface FlwMessageDetailsDto {
  file?: {
    publicUrl?: string | null
  } | null
  [key: string]: unknown
}

export interface FlwMessageDto {
  id: string
  sessionId: string
  direction: FlwMessageDirection | string
  origin: string
  type: string
  text: string | null
  userId: string | null
  createdAt: string
  updatedAt: string
  details?: FlwMessageDetailsDto | null
}

export interface MessagingSessionWritePayload {
  id: string
  clientId: string
  branchId: number | null
  provider: MessagingProviderValue
  externalSessionId: string
  contactExternalId: string | null
  assignedAgentEmail: string | null
  assignedAgentUserId: string | null
  status: string | null
  startedAt: Date
  endedAt: Date | null
  rawJson: FlwSessionDto
}

export interface MessagingMessageWritePayload {
  id: string
  clientId: string
  sessionId: string
  provider: MessagingProviderValue
  externalMessageId: string
  direction: MessagingDirectionValue
  senderType: MessagingSenderTypeValue
  messageType: string
  bodyText: string
  mediaUrl: string | null
  mediaType: string | null
  createdAtExternal: Date
  updatedAtExternal: Date
  rawJson: FlwMessageDto
}
