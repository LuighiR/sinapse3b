import { CallKpiAvailabilityService, type CallKpiAvailabilityRepository } from './call-kpi-availability.service'
import { CallKpiRefreshService, type CallKpiRefreshRepository } from './call-kpi-refresh.service'
import { type CallNormalizationResult } from '../../normalization/application/call-normalization.service'

describe('CallKpiRefreshService', () => {
  const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month, day, hour, minute))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('creates summary, hourly, ranking, and comparison materializations for calls', async () => {
    const refreshRepository: jest.Mocked<CallKpiRefreshRepository> = {
      ensureDefinitions: jest.fn().mockResolvedValue({
        summaryDefinitionId: 11n,
        hourlyDefinitionId: 12n,
        agentRankingDefinitionId: 13n,
        hourlyComparisonDefinitionId: 14n,
      }),
      listCallFacts: jest.fn().mockResolvedValue([
        {
          id: 1n,
          startedAt: utcDate(2026, 0, 5, 8, 10),
          isInboundToCompany: true,
          isReceived: true,
          isLost: false,
          agentResolutionType: 'EXTENSION_UUID',
          agentResolutionKey: 'ext-1',
          agentExtensionNumber: '104',
          extensionUuid: 'ext-1',
          employeeName: 'Maria',
        },
        {
          id: 2n,
          startedAt: utcDate(2026, 0, 5, 8, 20),
          isInboundToCompany: true,
          isReceived: false,
          isLost: true,
          agentResolutionType: 'EXTENSION_NUMBER',
          agentResolutionKey: '104',
          agentExtensionNumber: '104',
          extensionUuid: null,
          employeeName: null,
        },
        {
          id: 3n,
          startedAt: utcDate(2026, 0, 5, 10, 0),
          isInboundToCompany: true,
          isReceived: true,
          isLost: false,
          agentResolutionType: 'EXTENSION_UUID',
          agentResolutionKey: 'ext-2',
          agentExtensionNumber: '107',
          extensionUuid: 'ext-2',
          employeeName: 'Joao',
        },
        {
          id: 4n,
          startedAt: utcDate(2026, 0, 5, 10, 30),
          isInboundToCompany: false,
          isReceived: false,
          isLost: false,
          agentResolutionType: null,
          agentResolutionKey: null,
          agentExtensionNumber: null,
          extensionUuid: null,
          employeeName: null,
        },
      ]),
      listTelemarketingBudgetFacts: jest.fn().mockResolvedValue([
        {
          budgetDatetime: utcDate(2026, 0, 5, 8, 30),
          statusNormalized: 'OPEN',
        },
        {
          budgetDatetime: utcDate(2026, 0, 5, 10, 45),
          statusNormalized: 'WON',
        },
      ]),
      createCalculationRun: jest.fn().mockResolvedValue({ id: 41n }),
      completeCalculationRun: jest.fn().mockResolvedValue(undefined),
      failCalculationRun: jest.fn().mockResolvedValue(undefined),
      persistMaterialization: jest.fn().mockResolvedValue({
        snapshotsCreated: 5,
        breakdownsCreated: 153,
      }),
    }

    const availabilityRepository: jest.Mocked<CallKpiAvailabilityRepository> = {
      hasUsableCallFacts: jest.fn().mockResolvedValue(true),
      upsertAvailability: jest.fn().mockResolvedValue(undefined),
    }
    const callNormalizationService = {
      normalizeClientCalls: jest.fn<Promise<CallNormalizationResult>, [string]>().mockResolvedValue({
        recordsRead: 4,
        recordsWritten: 4,
      }),
    }

    const availabilityService = new CallKpiAvailabilityService(availabilityRepository)
    const service = new CallKpiRefreshService(
      refreshRepository,
      availabilityService,
      callNormalizationService as any,
    )

    const result = await service.refresh({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(callNormalizationService.normalizeClientCalls).toHaveBeenCalledWith('c1')
    expect(refreshRepository.listCallFacts).toHaveBeenCalledWith({
      clientId: 'c1',
      from: saoPauloPeriodDate(2026, 0, 5),
      to: saoPauloPeriodDate(2026, 0, 5),
    })
    expect(refreshRepository.listTelemarketingBudgetFacts).toHaveBeenCalledWith({
      clientId: 'c1',
      from: saoPauloPeriodDate(2026, 0, 5),
      to: saoPauloPeriodDate(2026, 0, 5),
    })

    expect(refreshRepository.persistMaterialization).toHaveBeenCalledWith({
      clientId: 'c1',
      summaryDefinitionId: 11n,
      hourlyDefinitionId: 12n,
      agentRankingDefinitionId: 13n,
      hourlyComparisonDefinitionId: 14n,
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 5),
        to: saoPauloPeriodDate(2026, 0, 5),
      }),
      summaryRows: [
        { metricKey: 'received.count', metricValue: '2', dimensionsJson: { family: 'calls' } },
        { metricKey: 'lost.count', metricValue: '1', dimensionsJson: { family: 'calls' } },
        { metricKey: 'total_inbound.count', metricValue: '3', dimensionsJson: { family: 'calls' } },
        {
          metricKey: 'telemarketing_open_budgets.count',
          metricValue: '1',
          dimensionsJson: { family: 'calls' },
        },
        {
          metricKey: 'peak_hour.count',
          metricValue: '2',
          dimensionsJson: { family: 'calls', hour: '08' },
        },
      ],
      hourlyRows: expect.arrayContaining([
        expect.objectContaining({
          bucketDate: saoPauloPeriodDate(2026, 0, 5),
          dimensionType: 'HOUR',
          dimensionKey: '08',
          dimensionLabel: '08',
          metricKey: 'received.count',
          metricValue: '1',
        }),
        expect.objectContaining({
          bucketDate: saoPauloPeriodDate(2026, 0, 5),
          dimensionType: 'HOUR',
          dimensionKey: '08',
          metricKey: 'lost.count',
          metricValue: '1',
        }),
        expect.objectContaining({
          bucketDate: saoPauloPeriodDate(2026, 0, 5),
          dimensionType: 'HOUR',
          dimensionKey: '10',
          metricKey: 'received.count',
          metricValue: '1',
        }),
      ]),
      rankingRows: expect.arrayContaining([
        expect.objectContaining({
          dimensionType: 'AGENT',
          dimensionKey: 'employee:ext-1',
          dimensionLabel: 'Maria',
          metricKey: 'received.count',
          metricValue: '1',
        }),
        expect.objectContaining({
          dimensionType: 'AGENT',
          dimensionKey: 'extension:104',
          dimensionLabel: '104',
          metricKey: 'lost.count',
          metricValue: '1',
        }),
      ]),
      comparisonRows: expect.arrayContaining([
        expect.objectContaining({
          dimensionType: 'HOUR',
          dimensionKey: '08',
          metricKey: 'telemarketing_budget.count',
          metricValue: '1',
        }),
        expect.objectContaining({
          dimensionType: 'HOUR',
          dimensionKey: '10',
          metricKey: 'telemarketing_budget.count',
          metricValue: '1',
        }),
      ]),
    })

    expect(availabilityRepository.hasUsableCallFacts).toHaveBeenCalledWith('c1')
    expect(availabilityRepository.upsertAvailability).toHaveBeenCalledTimes(4)
    expect(refreshRepository.completeCalculationRun).toHaveBeenCalledWith({
      runId: 41n,
      recordsRead: 4,
      recordsWritten: 158,
      finishedAt: expect.any(Date),
      status: 'COMPLETED',
    })
    expect(refreshRepository.failCalculationRun).not.toHaveBeenCalled()

    expect(result).toEqual({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
      calculationRunId: '41',
      recordsRead: 4,
      snapshotsCreated: 5,
      breakdownsCreated: 153,
      availabilityEnabled: true,
    })
  })
})
