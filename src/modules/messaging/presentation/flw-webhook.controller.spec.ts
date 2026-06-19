import { UnauthorizedException } from '@nestjs/common'
import { FlwWebhookController } from './flw-webhook.controller'

describe('FlwWebhookController', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sinapse',
      AUTH_JWT_SECRET: 'super-secret',
      AUTH_JWT_ISSUER: 'sinapse3',
      AUTH_JWT_AUDIENCE: 'sinapse3-web',
      INTERNAL_JOB_KEY: 'test-internal-job-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('accepts a single webhook URL and forwards the FLW envelope', async () => {
    const ingestService = {
      ingest: jest.fn().mockResolvedValue({
        accepted: true,
        event: 'MESSAGE_RECEIVED',
        storedSession: false,
        storedMessage: true,
      }),
    }
    const controller = new FlwWebhookController(ingestService as never)

    const payload = {
      eventType: 'MESSAGE_RECEIVED',
      date: '2026-06-01T10:01:00.000Z',
      content: { id: 'message-1' },
    }

    const result = await controller.ingest(undefined, 'ferracosul', payload)

    expect(result.event).toBe('MESSAGE_RECEIVED')
    expect(ingestService.ingest).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      payload,
    })
  })

  it('rejects invalid webhook secret when configured', async () => {
    process.env.FLW_WEBHOOK_SECRET = 'expected-secret'

    const controller = new FlwWebhookController({ ingest: jest.fn() } as never)

    await expect(
      controller.ingest('wrong-secret', 'ferracosul', { eventType: 'SESSION_NEW', content: {} }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
