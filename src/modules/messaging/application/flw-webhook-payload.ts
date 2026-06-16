export function resolveFlwWebhookEventType(payload: Record<string, unknown>): string {
  if (typeof payload.eventType === 'string') {
    return payload.eventType
  }

  if (typeof payload.event === 'string') {
    return payload.event
  }

  return 'UNKNOWN'
}

export function extractFlwWebhookContent(payload: Record<string, unknown>): Record<string, unknown> {
  if (
    payload.content != null &&
    typeof payload.content === 'object' &&
    !Array.isArray(payload.content)
  ) {
    return payload.content as Record<string, unknown>
  }

  return payload
}

export function isFlwSessionContent(content: Record<string, unknown>): boolean {
  return typeof content.id === 'string' && typeof content.startAt === 'string'
}

export function isFlwMessageContent(content: Record<string, unknown>): boolean {
  return (
    typeof content.id === 'string' &&
    typeof content.sessionId === 'string' &&
    typeof content.createdAt === 'string'
  )
}
