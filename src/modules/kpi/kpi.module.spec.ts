import { PrismaBudgetKpiRepository, PrismaSaleKpiRepository } from './kpi.module'
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
})
