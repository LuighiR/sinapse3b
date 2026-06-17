import {
  buildCanonicalMessagingContactId,
  MessagingContactWritePayload,
} from '../domain/messaging-contact-types'
import {
  DkwLegacySessionSnapshot,
  MessagingProviderValue,
  MessagingSessionWritePayload,
} from '../domain/messaging-types'
import { normalizePhoneForMatch } from './phone-normalization'

export function mapSessionToMessagingContact(input: {
  session: MessagingSessionWritePayload
  legacyContactId?: bigint | null
}): MessagingContactWritePayload | null {
  const { session } = input
  const externalContactId = session.contactExternalId?.trim()

  if (externalContactId == null || externalContactId === '') {
    return null
  }

  const phoneNormalized = resolvePhoneNormalized(session)

  return {
    id: buildCanonicalMessagingContactId(session.clientId, session.provider, externalContactId),
    clientId: session.clientId,
    provider: session.provider,
    externalContactId,
    displayName: resolveDisplayName(session),
    phoneNormalized,
    legacyContactId: input.legacyContactId ?? null,
    rawJson: session.rawJson,
  }
}

function resolvePhoneNormalized(session: MessagingSessionWritePayload): string | null {
  if (session.provider === 'DKW') {
    const rawSession = session.rawJson as DkwLegacySessionSnapshot | null
    const ticketPhone = rawSession?.ticket?.contactNumber ?? null

    return normalizePhoneForMatch(ticketPhone ?? session.contactExternalId)
  }

  return normalizePhoneForMatch(session.contactExternalId)
}

function resolveDisplayName(session: MessagingSessionWritePayload): string | null {
  if (session.provider !== 'DKW') {
    return null
  }

  const rawSession = session.rawJson as DkwLegacySessionSnapshot | null

  return rawSession?.ticket?.contactNumber?.trim() ?? null
}

export function isNumericExternalContactId(externalContactId: string): boolean {
  return /^\d+$/.test(externalContactId)
}

export function toProviderValue(value: string): MessagingProviderValue {
  if (value === 'DKW' || value === 'FLW') {
    return value
  }

  throw new Error(`Unsupported messaging provider: ${value}`)
}
