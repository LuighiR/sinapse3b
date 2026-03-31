import { BudgetKpiAvailabilityService, type BudgetKpiAvailabilityRepository } from './budget-kpi-availability.service'
import { BudgetKpiRefreshService, type BudgetKpiRefreshRepository } from './budget-kpi-refresh.service'
import { type BudgetNormalizationResult } from '../../normalization/application/budget-normalization.service'

describe('BudgetKpiRefreshService', () => {
  const utcDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('creates summary snapshots and breakdowns for a client period', async () => {
    const refreshRepository: jest.Mocked<BudgetKpiRefreshRepository> = {
      ensureDefinitions: jest.fn().mockResolvedValue({
        summaryDefinitionId: 11n,
        dailyDefinitionId: 12n,
        drilldownDefinitionId: 13n,
      }),
      listBudgetFacts: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          cancellationDate: null,
          cancelationTime: null,
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 1),
          cancellationDate: null,
          cancelationTime: null,
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 3),
          cancellationDate: null,
          cancelationTime: null,
          sellerId: 8,
          sellerName: 'Joao',
          statusNormalized: 'LOST',
          valueAmount: '75.00',
        },
      ]),
      createCalculationRun: jest.fn().mockResolvedValue({ id: 41n }),
      completeCalculationRun: jest.fn().mockResolvedValue(undefined),
      failCalculationRun: jest.fn().mockResolvedValue(undefined),
      persistMaterialization: jest.fn().mockResolvedValue({
        snapshotsCreated: 8,
        breakdownsCreated: 10,
      }),
    }

    const availabilityRepository: jest.Mocked<BudgetKpiAvailabilityRepository> = {
      hasUsableBudgetFacts: jest.fn().mockResolvedValue(true),
      upsertAvailability: jest.fn().mockResolvedValue(undefined),
    }
    const budgetNormalizationService = {
      normalizeClientBudgets: jest.fn<Promise<BudgetNormalizationResult>, [string]>().mockResolvedValue({
        recordsRead: 3,
        recordsWritten: 3,
      }),
    }

    const availabilityService = new BudgetKpiAvailabilityService(availabilityRepository)
    const service = new BudgetKpiRefreshService(
      refreshRepository,
      availabilityService,
      budgetNormalizationService as any,
    )

    const result = await service.refresh({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
    })

    expect(refreshRepository.ensureDefinitions).toHaveBeenCalledTimes(1)
    expect(budgetNormalizationService.normalizeClientBudgets).toHaveBeenCalledTimes(1)
    expect(budgetNormalizationService.normalizeClientBudgets).toHaveBeenCalledWith('c1')
    expect(refreshRepository.listBudgetFacts).toHaveBeenCalledWith({
      clientId: 'c1',
      from: saoPauloPeriodDate(2026, 0, 1),
      to: saoPauloPeriodDate(2026, 0, 3),
    })
    expect(refreshRepository.createCalculationRun).toHaveBeenCalledWith({
      clientId: 'c1',
      definitionId: 11n,
      runKey: expect.stringMatching(/^budgets:c1:2026-01-01_2026-01-03:\d+$/),
      status: 'RUNNING',
      periodType: 'RANGE',
      periodStart: saoPauloPeriodDate(2026, 0, 1),
      periodEnd: saoPauloPeriodDate(2026, 0, 3),
      recordsRead: 0,
      recordsWritten: 0,
      metadataJson: {
        family: 'budgets',
        periodKey: '2026-01-01_2026-01-03',
      },
    })

    expect(refreshRepository.persistMaterialization).toHaveBeenCalledTimes(1)
    expect(refreshRepository.persistMaterialization).toHaveBeenCalledWith({
      clientId: 'c1',
      summaryDefinitionId: 11n,
      dailyDefinitionId: 12n,
      drilldownDefinitionId: 13n,
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 3),
      }),
      summaryRows: [
        { metricKey: 'total.count', metricValue: '3', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'total.value', metricValue: '225.0000', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'open.count', metricValue: '1', dimensionsJson: { status: 'OPEN' } },
        { metricKey: 'open.value', metricValue: '50.0000', dimensionsJson: { status: 'OPEN' } },
        { metricKey: 'won.count', metricValue: '1', dimensionsJson: { status: 'WON' } },
        { metricKey: 'won.value', metricValue: '100.0000', dimensionsJson: { status: 'WON' } },
        { metricKey: 'lost.count', metricValue: '1', dimensionsJson: { status: 'LOST' } },
        { metricKey: 'lost.value', metricValue: '75.0000', dimensionsJson: { status: 'LOST' } },
      ],
      dailyRows: [
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'count',
          metricValue: '2',
          payloadJson: { bucket: '2026-01-01', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'value',
          metricValue: '150.0000',
          payloadJson: { bucket: '2026-01-01', family: 'budgets' },
          sortOrder: 1,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 2),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-02',
          dimensionLabel: '2026-01-02',
          metricKey: 'count',
          metricValue: '0',
          payloadJson: { bucket: '2026-01-02', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 2),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-02',
          dimensionLabel: '2026-01-02',
          metricKey: 'value',
          metricValue: '0.0000',
          payloadJson: { bucket: '2026-01-02', family: 'budgets' },
          sortOrder: 1,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 3),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-03',
          dimensionLabel: '2026-01-03',
          metricKey: 'count',
          metricValue: '1',
          payloadJson: { bucket: '2026-01-03', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: saoPauloPeriodDate(2026, 0, 3),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-03',
          dimensionLabel: '2026-01-03',
          metricKey: 'value',
          metricValue: '75.0000',
          payloadJson: { bucket: '2026-01-03', family: 'budgets' },
          sortOrder: 1,
        },
      ],
      drilldownRows: [
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'SELLER',
          dimensionKey: '7',
          dimensionLabel: 'Maria',
          metricKey: 'count',
          metricValue: '2',
          payloadJson: { sellerId: '7', sellerName: 'Maria', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'SELLER',
          dimensionKey: '7',
          dimensionLabel: 'Maria',
          metricKey: 'value',
          metricValue: '150.0000',
          payloadJson: { sellerId: '7', sellerName: 'Maria', family: 'budgets' },
          sortOrder: 1,
        },
        {
          bucketDate: utcDate(2026, 0, 3),
          dimensionType: 'SELLER',
          dimensionKey: '8',
          dimensionLabel: 'Joao',
          metricKey: 'count',
          metricValue: '1',
          payloadJson: { sellerId: '8', sellerName: 'Joao', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: utcDate(2026, 0, 3),
          dimensionType: 'SELLER',
          dimensionKey: '8',
          dimensionLabel: 'Joao',
          metricKey: 'value',
          metricValue: '75.0000',
          payloadJson: { sellerId: '8', sellerName: 'Joao', family: 'budgets' },
          sortOrder: 1,
        },
      ],
    })

    expect(availabilityRepository.hasUsableBudgetFacts).toHaveBeenCalledTimes(1)
    expect(availabilityRepository.hasUsableBudgetFacts).toHaveBeenCalledWith('c1')
    expect(availabilityRepository.upsertAvailability).toHaveBeenCalledTimes(3)
    expect(availabilityRepository.upsertAvailability).toHaveBeenNthCalledWith(1, {
      clientId: 'c1',
      definitionId: 11n,
      isEnabled: true,
      availableAt: expect.any(Date),
      metadataJson: {
        family: 'budgets',
        recordsRead: 3,
        periodKey: '2026-01-01_2026-01-03',
      },
    })
    expect(availabilityRepository.upsertAvailability).toHaveBeenNthCalledWith(2, {
      clientId: 'c1',
      definitionId: 12n,
      isEnabled: true,
      availableAt: expect.any(Date),
      metadataJson: {
        family: 'budgets',
        recordsRead: 3,
        periodKey: '2026-01-01_2026-01-03',
      },
    })
    expect(availabilityRepository.upsertAvailability).toHaveBeenNthCalledWith(3, {
      clientId: 'c1',
      definitionId: 13n,
      isEnabled: true,
      availableAt: expect.any(Date),
      metadataJson: {
        family: 'budgets',
        recordsRead: 3,
        periodKey: '2026-01-01_2026-01-03',
      },
    })

    expect(refreshRepository.completeCalculationRun).toHaveBeenCalledWith({
      runId: 41n,
      recordsRead: 3,
      recordsWritten: 18,
      finishedAt: expect.any(Date),
      status: 'COMPLETED',
    })
    expect(refreshRepository.failCalculationRun).not.toHaveBeenCalled()

    expect(result).toEqual({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
      calculationRunId: '41',
      recordsRead: 3,
      snapshotsCreated: 8,
      breakdownsCreated: 10,
      availabilityEnabled: true,
    })
  })
})
