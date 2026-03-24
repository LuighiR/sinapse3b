import { type BudgetNormalizationResult } from '../../normalization/application/budget-normalization.service'
import { SaleKpiAvailabilityService, type SaleKpiAvailabilityRepository } from './sale-kpi-availability.service'
import { SaleKpiRefreshService, type SaleKpiRefreshRepository } from './sale-kpi-refresh.service'

describe('SaleKpiRefreshService', () => {
  const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('creates summary snapshots and daily breakdowns for a client period', async () => {
    const refreshRepository: jest.Mocked<SaleKpiRefreshRepository> = {
      ensureDefinitions: jest.fn().mockResolvedValue({
        summaryDefinitionId: 21n,
        dailyDefinitionId: 22n,
      }),
      listSaleFacts: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'CANCELED',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          saleDate: utcDate(2026, 0, 3),
          sellerId: 8,
          sellerName: 'Joao',
          statusNormalized: 'VALID',
          valueAmount: '75.00',
        },
      ]),
      createCalculationRun: jest.fn().mockResolvedValue({ id: 51n }),
      completeCalculationRun: jest.fn().mockResolvedValue(undefined),
      failCalculationRun: jest.fn().mockResolvedValue(undefined),
      persistMaterialization: jest.fn().mockResolvedValue({
        snapshotsCreated: 9,
        breakdownsCreated: 6,
      }),
    }

    const availabilityRepository: jest.Mocked<SaleKpiAvailabilityRepository> = {
      hasUsableSaleFacts: jest.fn().mockResolvedValue(true),
      upsertAvailability: jest.fn().mockResolvedValue(undefined),
    }
    const saleNormalizationService = {
      normalizeClientSales: jest.fn<Promise<BudgetNormalizationResult>, [string]>().mockResolvedValue({
        recordsRead: 3,
        recordsWritten: 3,
      }),
    }

    const availabilityService = new SaleKpiAvailabilityService(availabilityRepository)
    const service = new SaleKpiRefreshService(refreshRepository, availabilityService, saleNormalizationService as any)

    const result = await service.refresh({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
    })

    expect(saleNormalizationService.normalizeClientSales).toHaveBeenCalledWith('c1')
    expect(refreshRepository.listSaleFacts).toHaveBeenCalledWith({
      clientId: 'c1',
      from: saoPauloPeriodDate(2026, 0, 1),
      to: saoPauloPeriodDate(2026, 0, 3),
    })
    expect(refreshRepository.persistMaterialization).toHaveBeenCalledWith({
      clientId: 'c1',
      summaryDefinitionId: 21n,
      dailyDefinitionId: 22n,
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 3),
      }),
      summaryRows: [
        { metricKey: 'total.count', metricValue: '3', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'total.value', metricValue: '225.0000', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'active.count', metricValue: '2', dimensionsJson: { status: 'ACTIVE' } },
        { metricKey: 'active.value', metricValue: '175.0000', dimensionsJson: { status: 'ACTIVE' } },
        { metricKey: 'canceled.count', metricValue: '1', dimensionsJson: { status: 'CANCELED' } },
        { metricKey: 'canceled.value', metricValue: '50.0000', dimensionsJson: { status: 'CANCELED' } },
        { metricKey: 'average_daily.count', metricValue: '1.0000', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'average_daily.value', metricValue: '75.0000', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'average_ticket.value', metricValue: '75.0000', dimensionsJson: { status: 'TOTAL' } },
      ],
      dailyRows: [
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'count',
          metricValue: '2',
          payloadJson: { bucket: '2026-01-01', family: 'sales' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'value',
          metricValue: '150.0000',
          payloadJson: { bucket: '2026-01-01', family: 'sales' },
          sortOrder: 1,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 2),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-02',
          dimensionLabel: '2026-01-02',
          metricKey: 'count',
          metricValue: '0',
          payloadJson: { bucket: '2026-01-02', family: 'sales' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 2),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-02',
          dimensionLabel: '2026-01-02',
          metricKey: 'value',
          metricValue: '0.0000',
          payloadJson: { bucket: '2026-01-02', family: 'sales' },
          sortOrder: 1,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 3),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-03',
          dimensionLabel: '2026-01-03',
          metricKey: 'count',
          metricValue: '1',
          payloadJson: { bucket: '2026-01-03', family: 'sales' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 3),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-03',
          dimensionLabel: '2026-01-03',
          metricKey: 'value',
          metricValue: '75.0000',
          payloadJson: { bucket: '2026-01-03', family: 'sales' },
          sortOrder: 1,
        },
      ],
    })

    expect(result).toEqual({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
      calculationRunId: '51',
      recordsRead: 3,
      snapshotsCreated: 9,
      breakdownsCreated: 6,
      availabilityEnabled: true,
    })
  })
})
