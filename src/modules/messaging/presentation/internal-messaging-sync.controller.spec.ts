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
    dkwMigrationJobService?: Record<string, jest.Mock>
    contactsBackfillJobService?: Record<string, jest.Mock>
    parityCheckService?: Record<string, jest.Mock>
  } = {}) {
    return new InternalMessagingSyncController(
      (overrides.syncService ?? { syncClient: jest.fn() }) as never,
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
        sessionsWritten: 1,
        messagesWritten: 2,
        lastSessionSyncAt: '2026-06-01T10:00:00.000Z',
        lastMessageSyncAt: '2026-06-01T10:01:00.000Z',
      }),
    }
    const controller = buildController({ syncService })

    const result = await controller.sync('test-internal-job-key', { clientId: 'ferracosul' })

    expect(result.clientId).toBe('ferracosul')
    expect(syncService.syncClient).toHaveBeenCalledWith('ferracosul')
  })

  it('accepts DKW migration jobs in background when job key is valid', () => {
    const dkwMigrationJobService = {
      start: jest.fn().mockReturnValue({
        status: 'accepted',
        message: 'task initiated',
        jobId: 'job-123',
      }),
      getStatus: jest.fn(),
    }
    const controller = buildController({ dkwMigrationJobService })

    const result = controller.migrateDkw('test-internal-job-key', {
      clientId: 'ferracosul',
      from: '2024-01-01',
      to: '2026-01-31',
    })

    expect(result).toEqual({
      status: 'accepted',
      message: 'task initiated',
      jobId: 'job-123',
    })
    expect(dkwMigrationJobService.start).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      period: expect.anything(),
      batchSize: 2000,
    })
  })

  it('accepts contacts backfill jobs in background when job key is valid', () => {
    const contactsBackfillJobService = {
      start: jest.fn().mockReturnValue({
        status: 'accepted',
        message: 'task initiated',
        jobId: 'job-contacts-1',
      }),
      getStatus: jest.fn(),
    }
    const controller = buildController({ contactsBackfillJobService })

    const result = controller.backfillContacts('test-internal-job-key', {
      clientId: 'ferracosul',
    })

    expect(result).toEqual({
      status: 'accepted',
      message: 'task initiated',
      jobId: 'job-contacts-1',
    })
    expect(contactsBackfillJobService.start).toHaveBeenCalledWith({
      clientId: 'ferracosul',
    })
  })

  it('returns migration job status when job key is valid', () => {
    const dkwMigrationJobService = {
      start: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        jobId: 'job-123',
        status: 'RUNNING',
      }),
    }
    const controller = buildController({ dkwMigrationJobService })

    const result = controller.getMigrateDkwStatus('test-internal-job-key', 'job-123')

    expect(result.status).toBe('RUNNING')
    expect(dkwMigrationJobService.getStatus).toHaveBeenCalledWith('job-123')
  })

  it('rejects missing job key', async () => {
    const controller = buildController()

    await expect(controller.sync(undefined, { clientId: 'ferracosul' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})
