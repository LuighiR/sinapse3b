import { KpiPeriod } from '../domain/kpi-period'
import { PrismaBudgetFollowUpDkwDispatchRepository } from './prisma-budget-follow-up-dkw-dispatch.repository'

describe('PrismaBudgetFollowUpDkwDispatchRepository', () => {
  it('lists joined dispatch candidates from core and raw', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          rawBudgetId: 123,
          clientId: 'ferracosul',
          sourceRecordId: 123,
          branchId: 5,
          sellerId: 7,
          statusNormalized: 'OPEN',
          budgetDatetime: '2026-04-01T08:00:00.000Z',
          closingDate: null,
          cancellationDate: null,
          cancelationTime: null,
          payloadJson: {},
          customerName: 'ACME LTDA',
          email: 'joao@gmail.com',
          cellPhone: '5551999999999',
          phone: null,
          valueAmount: '250.00',
          davId: '9001',
          sellerName: 'Maria',
          openingDatetime: '2026-04-01T08:00:00',
          sentDkwAt: null,
          dkwWebhook: 'https://employee.example/lead',
        },
      ]),
    }

    const repository = new PrismaBudgetFollowUpDkwDispatchRepository(prisma as any)

    await expect(
      repository.listDispatchCandidates({
        clientId: 'ferracosul',
        period: KpiPeriod.between({ from: '2026-04-01', to: '2026-04-02' }),
        sellerId: 7,
        branchId: 5,
        orderType: 'Balcao',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        rawBudgetId: 123,
        clientId: 'ferracosul',
        sellerId: 7,
        email: 'joao@gmail.com',
        dkwWebhook: 'https://employee.example/lead',
      }),
    ])

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)

    const sqlArg = prisma.$queryRaw.mock.calls[0]?.[0] as { strings?: TemplateStringsArray } | TemplateStringsArray | string
    const sqlText =
      typeof sqlArg === 'string'
        ? sqlArg
        : Array.isArray(sqlArg)
          ? sqlArg.join('?')
          : Array.isArray((sqlArg as { strings?: TemplateStringsArray })?.strings)
            ? ((sqlArg as { strings: TemplateStringsArray }).strings.join('?'))
            : String(sqlArg)

    expect(sqlText).toContain('employees')
    expect(sqlText).toContain('e.erp_id = fact.seller_id')
    expect(sqlText).not.toContain('employee_erp_users')
    expect(sqlText).not.toContain('eu.branch_id = fact.branch_id')
  })

  it('marks the raw budget as sent', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    }

    const repository = new PrismaBudgetFollowUpDkwDispatchRepository(prisma as any)
    const sentAt = new Date('2026-04-02T12:00:00.000Z')

    await repository.markAsSent({
      rawBudgetId: 123,
      sentAt,
    })

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
  })
})
