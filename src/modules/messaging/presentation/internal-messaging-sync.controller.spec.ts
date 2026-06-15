import { UnauthorizedException } from '@nestjs/common'
import { InternalMessagingSyncController } from './internal-messaging-sync.controller'

describe('InternalMessagingSyncController', () => {
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

  it('runs sync when job key is valid', async () => {
    const syncService = {
      syncClient: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        sessionsFetched: 1,
        messagesFetched: 2,
        sessionsWritten: 1,
        messagesWritten: 2,
        lastSessionSyncAt: '2026-06-01T10:00:00.000Z',
        lastMessageSyncAt: '2026-06-01T10:01:00.000Z',
      }),
    }
    const controller = new InternalMessagingSyncController(syncService as never)

    const result = await controller.sync('test-internal-job-key', { clientId: 'ferracosul' })

    expect(result.clientId).toBe('ferracosul')
    expect(syncService.syncClient).toHaveBeenCalledWith('ferracosul')
  })

  it('rejects missing job key', async () => {
    const controller = new InternalMessagingSyncController({ syncClient: jest.fn() } as never)

    await expect(controller.sync(undefined, { clientId: 'ferracosul' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})
