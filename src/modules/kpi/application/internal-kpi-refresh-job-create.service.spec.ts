import { UnauthorizedException } from '@nestjs/common'
import { InternalKpiRefreshJobCreateService } from './internal-kpi-refresh-job-create.service'

class TestableInternalKpiRefreshJobCreateService extends InternalKpiRefreshJobCreateService {
  scheduledJobIds: bigint[] = []
  scheduledTasks: Array<() => Promise<void>> = []

  protected override scheduleExecution(jobId: bigint, task: () => Promise<void>) {
    this.scheduledJobIds.push(jobId)
    this.scheduledTasks.push(task)
  }
}

describe('InternalKpiRefreshJobCreateService', () => {
  it('creates a pending api job and returns the accepted payload', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const tenantResolver = {
      resolveBySlug: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        slug: 'ferracosul-kpi-dev',
        clientId: 'client-1',
        clientSlug: 'ferracosul',
        clientName: 'Ferracosul',
      }),
    }
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 41n }),
    }
    const executeService = {
      execute: jest.fn().mockResolvedValue(undefined),
    }
    const service = new TestableInternalKpiRefreshJobCreateService(
      jobKeyAuthorizer as any,
      tenantResolver as any,
      repository as any,
      executeService as any,
    )

    const result = await service.create({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })

    expect(jobKeyAuthorizer.assertValid).toHaveBeenCalledWith('job-secret')
    expect(tenantResolver.resolveBySlug).toHaveBeenCalledWith('ferracosul-kpi-dev')
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        clientId: 'client-1',
        slug: 'ferracosul-kpi-dev',
        triggerType: 'api',
        status: 'PENDING',
      }),
    )
    const createInput = repository.create.mock.calls[0][0]
    expect(createInput.requestedFrom.toISOString().slice(0, 10)).toBe('2026-04-01')
    expect(createInput.requestedTo.toISOString().slice(0, 10)).toBe('2026-04-06')
    expect(result).toEqual({
      status: 'accepted',
      message: 'task initiated',
      jobId: '41',
    })
    expect(service.scheduledJobIds).toEqual([41n])
  })

  it('dispatches background execution after persistence without awaiting completion', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const tenantResolver = {
      resolveBySlug: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        slug: 'ferracosul-kpi-dev',
        clientId: 'client-1',
        clientSlug: 'ferracosul',
        clientName: 'Ferracosul',
      }),
    }
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 73n }),
    }
    const executeService = {
      execute: jest.fn().mockResolvedValue(undefined),
    }
    const service = new TestableInternalKpiRefreshJobCreateService(
      jobKeyAuthorizer as any,
      tenantResolver as any,
      repository as any,
      executeService as any,
    )

    const result = await service.create({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })

    expect(result.jobId).toBe('73')
    expect(executeService.execute).not.toHaveBeenCalled()
    expect(service.scheduledTasks).toHaveLength(1)

    await service.scheduledTasks[0]()

    expect(executeService.execute).toHaveBeenCalledWith(73n)
  })

  it('rejects an invalid job key before persisting anything', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn().mockImplementation(() => {
        throw new UnauthorizedException('Invalid job key')
      }),
    }
    const tenantResolver = {
      resolveBySlug: jest.fn(),
    }
    const repository = {
      create: jest.fn(),
    }
    const executeService = {
      execute: jest.fn(),
    }
    const service = new TestableInternalKpiRefreshJobCreateService(
      jobKeyAuthorizer as any,
      tenantResolver as any,
      repository as any,
      executeService as any,
    )

    await expect(
      service.create({
        jobKey: 'wrong-key',
        slug: 'ferracosul-kpi-dev',
        from: '2026-04-01',
        to: '2026-04-06',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(tenantResolver.resolveBySlug).not.toHaveBeenCalled()
    expect(repository.create).not.toHaveBeenCalled()
    expect(executeService.execute).not.toHaveBeenCalled()
    expect(service.scheduledJobIds).toEqual([])
  })
})
