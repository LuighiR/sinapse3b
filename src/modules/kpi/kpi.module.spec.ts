import { PrismaBudgetKpiRepository, PrismaInternalKpiRefreshJobRepository, PrismaSaleKpiRepository } from './kpi.module'
import { KpiPeriod } from './domain/kpi-period'

describe('KpiModule repositories', () => {
  const period = KpiPeriod.between({
    from: '2026-01-01',
    to: '2026-01-31',
  })

  it('applies branchId in the budget fact Prisma where clause', async () => {
    const prisma = {
      budgetFact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const repository = new PrismaBudgetKpiRepository(prisma as any)

    await repository.getBudgetFactRows({
      clientId: 'client-1',
      period,
      branchId: 5,
      sellerId: 7,
    })

    expect(prisma.budgetFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          branchId: 5,
          sellerId: 7,
        }),
      }),
    )
  })

  it('applies branchId in the sale fact Prisma where clause', async () => {
    const prisma = {
      saleFact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const repository = new PrismaSaleKpiRepository(prisma as any)

    await repository.getSaleFactRows({
      clientId: 'client-1',
      period,
      branchId: 8,
      sellerId: 9,
    })

    expect(prisma.saleFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          branchId: 8,
          sellerId: 9,
        }),
      }),
    )
  })

  it('persists and updates refresh jobs through Prisma', async () => {
    const prisma = {
      refreshJob: {
        create: jest.fn().mockResolvedValue({ id: 41n }),
        findUnique: jest.fn().mockResolvedValue({
          id: 41n,
          tenantId: 'tenant-1',
          clientId: 'client-1',
          slug: 'ferracosul-kpi-dev',
          triggerType: 'api',
          requestedFrom: new Date('2026-04-01T00:00:00.000Z'),
          requestedTo: new Date('2026-04-06T00:00:00.000Z'),
          status: 'RUNNING',
          requestedAt: new Date('2026-04-08T12:00:00.000Z'),
          startedAt: new Date('2026-04-08T12:00:01.000Z'),
          finishedAt: null,
          errorMessage: null,
          resultsJson: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    }
    const repository = new PrismaInternalKpiRefreshJobRepository(prisma as any)

    await expect(
      repository.create({
        tenantId: 'tenant-1',
        clientId: 'client-1',
        slug: 'ferracosul-kpi-dev',
        triggerType: 'api',
        requestedFrom: new Date('2026-04-01T00:00:00.000Z'),
        requestedTo: new Date('2026-04-06T00:00:00.000Z'),
        status: 'PENDING',
      }),
    ).resolves.toEqual({ id: 41n })

    await expect(repository.findById(41n)).resolves.toEqual(
      expect.objectContaining({
        id: 41n,
        status: 'RUNNING',
        slug: 'ferracosul-kpi-dev',
      }),
    )

    await repository.markRunning({
      jobId: 41n,
      startedAt: new Date('2026-04-08T12:00:01.000Z'),
    })

    await repository.complete({
      jobId: 41n,
      status: 'PARTIAL_SUCCESS',
      finishedAt: new Date('2026-04-08T12:00:09.000Z'),
      errorMessage: 'budgets: failed',
      resultsJson: {
        overallStatus: 'partial_success',
        results: [],
      },
    })

    expect(prisma.refreshJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          clientId: 'client-1',
          status: 'PENDING',
        }),
      }),
    )
    expect(prisma.refreshJob.findUnique).toHaveBeenCalledWith({
      where: {
        id: 41n,
      },
      select: expect.any(Object),
    })
    expect(prisma.refreshJob.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 41n },
        data: expect.objectContaining({
          status: 'RUNNING',
        }),
      }),
    )
    expect(prisma.refreshJob.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 41n },
        data: expect.objectContaining({
          status: 'PARTIAL_SUCCESS',
          errorMessage: 'budgets: failed',
        }),
      }),
    )
  })
})
