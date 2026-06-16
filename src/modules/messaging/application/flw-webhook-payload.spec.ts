import {
  extractFlwWebhookContent,
  isFlwMessageContent,
  isFlwSessionContent,
  resolveFlwWebhookEventType,
} from './flw-webhook-payload'

describe('flw-webhook-payload', () => {
  it('reads eventType and content from the FLW webhook envelope', () => {
    const payload = {
      eventType: 'MESSAGE_RECEIVED',
      date: '2026-06-01T10:01:00.000Z',
      content: {
        id: 'message-1',
        sessionId: 'session-1',
        createdAt: '2026-06-01T10:01:00.000Z',
      },
    }

    expect(resolveFlwWebhookEventType(payload)).toBe('MESSAGE_RECEIVED')
    expect(extractFlwWebhookContent(payload)).toEqual(payload.content)
    expect(isFlwMessageContent(payload.content as Record<string, unknown>)).toBe(true)
  })

  it('falls back to event when eventType is absent', () => {
    expect(resolveFlwWebhookEventType({ event: 'SESSION_NEW' })).toBe('SESSION_NEW')
  })

  it('detects session content shape', () => {
    expect(
      isFlwSessionContent({
        id: 'session-1',
        startAt: '2026-06-01T10:00:00.000Z',
      }),
    ).toBe(true)
  })
})
