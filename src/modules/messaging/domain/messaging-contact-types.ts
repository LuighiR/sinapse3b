import { MessagingProviderValue } from './messaging-types'

export interface MessagingContactWritePayload {
  id: string
  clientId: string
  provider: MessagingProviderValue
  externalContactId: string
  displayName: string | null
  phoneNormalized: string | null
  legacyContactId: bigint | null
  rawJson: unknown
}

export interface MessagingSessionContactKey {
  clientId: string
  provider: MessagingProviderValue
  contactExternalId: string
}

export function buildCanonicalMessagingContactId(
  clientId: string,
  provider: MessagingProviderValue,
  externalContactId: string,
): string {
  return `${clientId}:${provider}:${externalContactId}`
}
