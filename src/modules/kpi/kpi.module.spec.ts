import { Test } from '@nestjs/testing'
import { BudgetKpiQueryService } from './application/budget-kpi-query.service'
import { KpiModule } from './kpi.module'
import { PrismaService } from '../../infra/prisma/prisma.service'

describe('KpiModule budget repository integration', () => {
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day))

  it('queries budget facts with cancellation fields selected for summary and drilldown flows', async () => {
    const budgetFactFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T09:00:00-03:00'),
          closingDate: null,
          cancellationDate: new Date('2026-01-05T00:00:00-03:00'),
          cancelationTime: '10:15:00',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          valueAmount: { toString: () => '50.0000' },
          payloadJson: {},
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 2n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 2,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T09:00:00-03:00'),
          closingDate: null,
          cancellationDate: new Date('2026-01-05T00:00:00-03:00'),
          cancelationTime: '10:15:00',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: { toString: () => '50.0000' },
          sequential: null,
          davId: 2n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
      ])

    const moduleRef = await Test.createTestingModule({
      imports: [KpiModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        budgetFact: {
          findMany: budgetFactFindMany,
        },
      })
      .compile()

    const service = moduleRef.get(BudgetKpiQueryService)

    await service.getFollowUpSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T09:00:00-03:00',
    })

    await service.getFollowUpDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T09:00:00-03:00',
    })

    expect(budgetFactFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        clientId: 'c1',
        budgetDate: {
          gte: saoPauloPeriodDate(2026, 0, 1),
          lte: saoPauloPeriodDate(2026, 0, 31),
        },
      },
      orderBy: [{ budgetDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        budgetDate: true,
        budgetDatetime: true,
        closingDate: true,
        cancellationDate: true,
        cancelationTime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        valueAmount: true,
        payloadJson: true,
      },
    })
    expect(budgetFactFindMany).toHaveBeenNthCalledWith(2, {
      where: {
        clientId: 'c1',
        budgetDate: {
          gte: saoPauloPeriodDate(2026, 0, 1),
          lte: saoPauloPeriodDate(2026, 0, 31),
        },
      },
      orderBy: [{ budgetDate: 'asc' }, { sellerId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        clientId: true,
        sourceTable: true,
        sourceRecordId: true,
        branchName: true,
        branchId: true,
        sellerId: true,
        sellerName: true,
        budgetDate: true,
        budgetDatetime: true,
        closingDate: true,
        cancellationDate: true,
        cancelationTime: true,
        statusNormalized: true,
        channel: true,
        customerName: true,
        cpfCnpj: true,
        valueAmount: true,
        sequential: true,
        davId: true,
        sequentialLinkedSale: true,
        payloadJson: true,
      },
    })
  })
})
