import { NotFoundException } from '@nestjs/common'
import { InternalKpiRefreshJobStatusService } from './internal-kpi-refresh-job-status.service'

describe('InternalKpiRefreshJobStatusService', () => {
  it('maps a pending job with null progress fields', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 41n,
        tenantId: 'tenant-1',
        clientId: 'client-1',
        slug: 'ferracosul-kpi-dev',
        triggerType: 'api',
        requestedFrom: new Date('2026-04-01T00:00:00.000Z'),
        requestedTo: new Date('2026-04-06T00:00:00.000Z'),
        status: 'PENDING',
        requestedAt: new Date('2026-04-08T12:00:00.000Z'),
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        resultsJson: null,
      }),
    }
    const service = new InternalKpiRefreshJobStatusService(jobKeyAuthorizer as any, repository as any)

    await expect(service.getStatus({ jobId: '41', jobKey: 'job-secret' })).resolves.toEqual({
      jobId: '41',
      status: 'PENDING',
      slug: 'ferracosul-kpi-dev',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      from: '2026-04-01',
      to: '2026-04-06',
      triggerType: 'api',
      requestedAt: '2026-04-08T12:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      results: null,
    })
    expect(jobKeyAuthorizer.assertValid).toHaveBeenCalledWith('job-secret')
  })

  it('maps persisted results for completed jobs', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 42n,
        tenantId: 'tenant-1',
        clientId: 'client-1',
        slug: 'ferracosul-kpi-dev',
        triggerType: 'api',
        requestedFrom: new Date('2026-04-01T00:00:00.000Z'),
        requestedTo: new Date('2026-04-06T00:00:00.000Z'),
        status: 'PARTIAL_SUCCESS',
        requestedAt: new Date('2026-04-08T12:00:00.000Z'),
        startedAt: new Date('2026-04-08T12:00:01.000Z'),
        finishedAt: new Date('2026-04-08T12:00:09.000Z'),
        errorMessage: 'budgets: Budget refresh failed',
        resultsJson: {
          overallStatus: 'partial_success',
          results: [
            {
              job: 'budgets',
              status: 'failed',
              startedAt: '2026-04-08T12:00:01.000Z',
              finishedAt: '2026-04-08T12:00:03.000Z',
              error: 'Budget refresh failed',
            },
          ],
        },
      }),
    }
    const service = new InternalKpiRefreshJobStatusService(jobKeyAuthorizer as any, repository as any)

    await expect(service.getStatus({ jobId: '42', jobKey: 'job-secret' })).resolves.toEqual({
      jobId: '42',
      status: 'PARTIAL_SUCCESS',
      slug: 'ferracosul-kpi-dev',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      from: '2026-04-01',
      to: '2026-04-06',
      triggerType: 'api',
      requestedAt: '2026-04-08T12:00:00.000Z',
      startedAt: '2026-04-08T12:00:01.000Z',
      finishedAt: '2026-04-08T12:00:09.000Z',
      errorMessage: 'budgets: Budget refresh failed',
      results: {
        overallStatus: 'partial_success',
        results: [
          {
            job: 'budgets',
            status: 'failed',
            startedAt: '2026-04-08T12:00:01.000Z',
            finishedAt: '2026-04-08T12:00:03.000Z',
            error: 'Budget refresh failed',
          },
        ],
      },
    })
    expect(jobKeyAuthorizer.assertValid).toHaveBeenCalledWith('job-secret')
  })

  it('returns 404 for an unknown job id', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const repository = {
      findById: jest.fn().mockResolvedValue(null),
    }
    const service = new InternalKpiRefreshJobStatusService(jobKeyAuthorizer as any, repository as any)

    await expect(service.getStatus({ jobId: '404', jobKey: 'job-secret' })).rejects.toBeInstanceOf(NotFoundException)
  })
})
