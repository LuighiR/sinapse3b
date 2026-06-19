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

  function buildController(overrides: {
    syncService?: Record<string, jest.Mock>
    normalizationService?: Record<string, jest.Mock>
    dkwMigrationJobService?: Record<string, jest.Mock>
    contactsBackfillJobService?: Record<string, jest.Mock>
    parityCheckService?: Record<string, jest.Mock>
  } = {}) {
    return new InternalMessagingSyncController(
      (overrides.syncService ?? { syncClient: jest.fn() }) as never,
      (overrides.normalizationService ?? { normalizeClient: jest.fn() }) as never,
      (overrides.dkwMigrationJobService ?? { start: jest.fn(), getStatus: jest.fn() }) as never,
      (overrides.contactsBackfillJobService ?? { start: jest.fn(), getStatus: jest.fn() }) as never,
      (overrides.parityCheckService ?? { checkClient: jest.fn() }) as never,
    )
  }

  it('runs sync when job key is valid', async () => {
    const syncService = {
      syncClient: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        sessionsFetched: 1,
        messagesFetched: 2,
        lastSessionSyncAt: '2026-06-01T10:00:00.000Z',
        lastMessageSyncAt: '2026-06-01T10:01:00.000Z',
      }),
    }
    const controller = buildController({ syncService })

    const result = await controller.sync('test-internal-job-key', { clientId: 'ferracosul' })

    expect(result.clientId).toBe('ferracosul')
    expect(syncService.syncClient).toHaveBeenCalledWith('ferracosul')
  })

  it('runs raw-to-core normalization when job key is valid', async () => {
    const normalizationService = {
      normalizeClient: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        mode: 'incremental',
        sessionsWritten: 2,
        messagesWritten: 5,
      }),
    }
    const controller = buildController({ normalizationService })

    const result = await controller.normalize('test-internal-job-key', { clientId: 'ferracosul' })

    expect(result.clientId).toBe('ferracosul')
    expect(normalizationService.normalizeClient).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      full: false,
    })
  })

  it('rejects missing job key', async () => {
    const controller = buildController()

    await expect(controller.sync(undefined, { clientId: 'ferracosul' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})
