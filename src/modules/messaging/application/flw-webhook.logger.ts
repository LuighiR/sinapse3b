import { loadEnv } from '../../../config/env'
import { extractFlwWebhookContent, resolveFlwWebhookEventType } from './flw-webhook-payload'

const LOG_PREFIX = '[flw-webhook]'

function isDebugEnabled(): boolean {
  return loadEnv(process.env).FLW_WEBHOOK_DEBUG
}

export function logFlwWebhookReceived(input: {
  clientId: string
  payload: Record<string, unknown>
}): void {
  const event = resolveFlwWebhookEventType(input.payload)
  const content = extractFlwWebhookContent(input.payload)
  const contentKeys = Object.keys(content)

  console.log(`${LOG_PREFIX} received`, {
    clientId: input.clientId,
    event,
    date: typeof input.payload.date === 'string' ? input.payload.date : null,
    contentKeys,
  })

  if (isDebugEnabled()) {
    console.log(`${LOG_PREFIX} payload`, JSON.stringify(input.payload))
  }
}

export function logFlwWebhookIgnored(input: { clientId: string; event: string }): void {
  console.log(`${LOG_PREFIX} ignored`, {
    clientId: input.clientId,
    event: input.event,
  })
}

export function logFlwWebhookStoredSession(input: {
  clientId: string
  event: string
  sessionId: string
}): void {
  console.log(`${LOG_PREFIX} stored session`, input)
}

export function logFlwWebhookStoredMessage(input: {
  clientId: string
  event: string
  messageId: string
  sessionId: string
}): void {
  console.log(`${LOG_PREFIX} stored message`, input)
}

export function logFlwWebhookNoExtractableContent(input: {
  clientId: string
  event: string
}): void {
  console.log(`${LOG_PREFIX} no extractable content`, input)
}

export function logFlwWebhookNormalized(input: {
  clientId: string
  event: string
  normalizedSessions: number
  normalizedMessages: number
}): void {
  console.log(`${LOG_PREFIX} normalized`, input)
}

export function logFlwWebhookFailed(input: {
  clientId: string
  event: string
  error: string
}): void {
  console.log(`${LOG_PREFIX} failed`, input)
}

export function logFlwWebhookAuthFailed(input: { clientId: string }): void {
  console.log(`${LOG_PREFIX} auth failed`, input)
}
