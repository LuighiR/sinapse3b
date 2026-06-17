import { KpiPeriod } from '../../kpi/domain/kpi-period'
import { MessagingContactsBackfillJobService } from './messaging-contacts-backfill-job.service'

describe('MessagingContactsBackfillJobService', () => {
  it('accepts a job and runs backfill in background', async () => {
    const backfillClient = jest.fn().mockResolvedValue({
      clientId: 'ferracosul',
      from: '2024-01-01',
      to: '2024-01-31',
      distinctContactKeys: 3,
      contactsWritten: 3,
      sessionsLinked: 10,
    })

    class TestableJobService extends MessagingContactsBackfillJobService {
      protected scheduleExecution(jobId: string): void {
        void this['execute'](jobId)
      }
    }

    const service = new TestableJobService({ backfillClient } as never)

    const accepted = service.start({
      clientId: 'ferracosul',
      period: KpiPeriod.between({ from: '2024-01-01', to: '2024-01-31' }),
    })

    expect(accepted).toEqual({
      status: 'accepted',
      message: 'task initiated',
      jobId: accepted.jobId,
    })

    await new Promise((resolve) => setImmediate(resolve))

    const status = service.getStatus(accepted.jobId)

    expect(status.status).toBe('COMPLETED')
    expect(status.result?.contactsWritten).toBe(3)
    expect(backfillClient).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      period: expect.any(KpiPeriod),
    })
  })
})
