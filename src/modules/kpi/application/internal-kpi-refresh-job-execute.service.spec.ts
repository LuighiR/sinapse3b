import { InternalKpiRefreshJobExecuteService } from './internal-kpi-refresh-job-execute.service'

describe('InternalKpiRefreshJobExecuteService', () => {
  it('runs budgets, sales, and calls in order and persists success results', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
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
      markRunning: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn().mockResolvedValue(undefined),
    }
    const callOrder: string[] = []
    const budgetRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('budgets')
      }),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('sales')
      }),
    }
    const callRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('calls')
      }),
    }
    const service = new InternalKpiRefreshJobExecuteService(
      repository as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    await service.execute(41n)

    expect(repository.findById).toHaveBeenCalledWith(41n)
    expect(repository.markRunning).toHaveBeenCalledWith({
      jobId: 41n,
      startedAt: expect.any(Date),
    })
    expect(callOrder).toEqual(['budgets', 'sales', 'calls'])
    expect(repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 41n,
        status: 'SUCCESS',
        errorMessage: null,
        finishedAt: expect.any(Date),
        resultsJson: expect.objectContaining({
          overallStatus: 'success',
          results: [
            expect.objectContaining({ job: 'budgets', status: 'success' }),
            expect.objectContaining({ job: 'sales', status: 'success' }),
            expect.objectContaining({ job: 'calls', status: 'success' }),
          ],
        }),
      }),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('background execution started'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('background execution finished'))

    consoleLogSpy.mockRestore()
  })

  it('continues after a step failure and persists partial success', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 42n,
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
      markRunning: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn().mockResolvedValue(undefined),
    }
    const callOrder: string[] = []
    const budgetRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('budgets')
        throw new Error('Budget refresh failed')
      }),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('sales')
      }),
    }
    const callRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('calls')
      }),
    }
    const service = new InternalKpiRefreshJobExecuteService(
      repository as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    await service.execute(42n)

    expect(callOrder).toEqual(['budgets', 'sales', 'calls'])
    expect(repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 42n,
        status: 'PARTIAL_SUCCESS',
        errorMessage: 'budgets: Budget refresh failed',
        resultsJson: expect.objectContaining({
          overallStatus: 'partial_success',
          results: [
            expect.objectContaining({ job: 'budgets', status: 'failed', error: 'Budget refresh failed' }),
            expect.objectContaining({ job: 'sales', status: 'success' }),
            expect.objectContaining({ job: 'calls', status: 'success' }),
          ],
        }),
      }),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('step failed jobId=42 job=budgets'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('background execution finished'))

    consoleLogSpy.mockRestore()
  })

  it('persists failed when every refresh family fails', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 43n,
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
      markRunning: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn().mockResolvedValue(undefined),
    }
    const budgetRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Budget refresh failed')),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Sale refresh failed')),
    }
    const callRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Call refresh failed')),
    }
    const service = new InternalKpiRefreshJobExecuteService(
      repository as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    await service.execute(43n)

    expect(repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 43n,
        status: 'FAILED',
        errorMessage: 'budgets: Budget refresh failed; sales: Sale refresh failed; calls: Call refresh failed',
        resultsJson: expect.objectContaining({
          overallStatus: 'failed',
        }),
      }),
    )
  })
})
