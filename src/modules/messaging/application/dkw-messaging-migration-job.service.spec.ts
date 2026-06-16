import { ConflictException, NotFoundException } from '@nestjs/common'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import { DkwMessagingMigrationJobService } from './dkw-messaging-migration-job.service'

describe('DkwMessagingMigrationJobService', () => {
  it('accepts a job and runs migration in background', async () => {
    const migrateClient = jest.fn().mockResolvedValue({
      clientId: 'ferracosul',
      from: '2024-01-01',
      to: '2024-01-31',
      batchSize: 2000,
      windowsProcessed: 1,
      totals: {
        sessionsRead: 1,
        sessionsWritten: 1,
        messagesExpected: 10,
        messagesRead: 10,
        messagesWritten: 10,
        messagesSkippedMissingSession: 0,
        batchesProcessed: 1,
      },
      windows: [],
    })

    class TestableJobService extends DkwMessagingMigrationJobService {
      protected scheduleExecution(jobId: string): void {
        void this['execute'](jobId)
      }
    }

    const service = new TestableJobService({ migrateClient } as never)

    const accepted = service.start({
      clientId: 'ferracosul',
      period: KpiPeriod.between({ from: '2024-01-01', to: '2024-01-31' }),
      batchSize: 2000,
    })

    expect(accepted).toEqual({
      status: 'accepted',
      message: 'task initiated',
      jobId: accepted.jobId,
    })

    await new Promise((resolve) => setImmediate(resolve))

    const status = service.getStatus(accepted.jobId)

    expect(status.status).toBe('COMPLETED')
    expect(status.result?.totals.messagesWritten).toBe(10)
    expect(migrateClient).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      period: expect.any(KpiPeriod),
      batchSize: 2000,
    })
  })

  it('rejects a second concurrent job for the same client', async () => {
    class HangingJobService extends DkwMessagingMigrationJobService {
      protected scheduleExecution(): void {
        // keep job in RUNNING without finishing
      }
    }

    const service = new HangingJobService({
      migrateClient: jest.fn(),
    } as never)

    const accepted = service.start({
      clientId: 'ferracosul',
      period: KpiPeriod.between({ from: '2024-01-01', to: '2024-01-31' }),
      batchSize: 2000,
    })

    const job = service['jobs'].get(accepted.jobId)
    job!.status = 'RUNNING'
    service['runningClientIds'].add('ferracosul')

    expect(() =>
      service.start({
        clientId: 'ferracosul',
        period: KpiPeriod.between({ from: '2024-02-01', to: '2024-02-29' }),
        batchSize: 2000,
      }),
    ).toThrow(ConflictException)
  })

  it('returns not found for unknown job ids', () => {
    const service = new DkwMessagingMigrationJobService({ migrateClient: jest.fn() } as never)

    expect(() => service.getStatus('missing-job')).toThrow(NotFoundException)
  })
})
