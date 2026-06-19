import { FlwWebhookIngestService } from './flw-webhook-ingest.service'

describe('FlwWebhookIngestService', () => {
  it('stores FLW webhook message payloads in raw only', async () => {
    const rawRepository = {
      upsertSession: jest.fn().mockResolvedValue(undefined),
      upsertMessage: jest.fn().mockResolvedValue(undefined),
    }

    const service = new FlwWebhookIngestService(rawRepository as never)

    const result = await service.ingest({
      clientId: 'ferracosul',
      payload: {
        eventType: 'MESSAGE_RECEIVED',
        date: '2026-06-01T10:01:00.000Z',
        content: {
          id: 'message-1',
          sessionId: 'session-1',
          direction: 'TO_HUB',
          origin: 'DEFAULT',
          type: 'TEXT',
          text: 'Oi',
          userId: null,
          createdAt: '2026-06-01T10:01:00.000Z',
          updatedAt: '2026-06-01T10:01:00.000Z',
        },
      },
    })

    expect(result).toEqual({
      accepted: true,
      event: 'MESSAGE_RECEIVED',
      storedSession: false,
      storedMessage: true,
    })
    expect(rawRepository.upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'webhook' }),
    )
  })

  it('stores session events from content', async () => {
    const rawRepository = {
      upsertSession: jest.fn().mockResolvedValue(undefined),
      upsertMessage: jest.fn().mockResolvedValue(undefined),
    }

    const service = new FlwWebhookIngestService(rawRepository as never)

    const result = await service.ingest({
      clientId: 'ferracosul',
      payload: {
        eventType: 'SESSION_NEW',
        date: '2026-06-01T10:00:00.000Z',
        content: {
          id: 'session-1',
          startAt: '2026-06-01T10:00:00.000Z',
          endAt: null,
          contactId: 'contact-1',
          userId: null,
          status: 'IN_PROGRESS',
        },
      },
    })

    expect(result.accepted).toBe(true)
    expect(result.storedSession).toBe(true)
    expect(rawRepository.upsertSession).toHaveBeenCalled()
    expect(rawRepository.upsertMessage).not.toHaveBeenCalled()
  })

  it('ignores unsupported webhook events', async () => {
    const service = new FlwWebhookIngestService(
      { upsertSession: jest.fn(), upsertMessage: jest.fn() } as never,
    )

    const result = await service.ingest({
      clientId: 'ferracosul',
      payload: {
        eventType: 'PANEL_CARD_NEW',
        content: {},
      },
    })

    expect(result.accepted).toBe(false)
  })
})
