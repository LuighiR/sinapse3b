import { CallKpiQueryService, type CallKpiQueryRepository } from './call-kpi-query.service'

describe('CallKpiQueryService', () => {
  const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month, day, hour, minute))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('returns call summary cards for a client period', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([
        { metricKey: 'received.count', metricValue: '12', dimensionsJson: { family: 'calls' } },
        { metricKey: 'lost.count', metricValue: '4', dimensionsJson: { family: 'calls' } },
        { metricKey: 'total_inbound.count', metricValue: '16', dimensionsJson: { family: 'calls' } },
        {
          metricKey: 'telemarketing_open_budgets.count',
          metricValue: '3',
          dimensionsJson: { family: 'calls' },
        },
        {
          metricKey: 'peak_hour.count',
          metricValue: '7',
          dimensionsJson: { family: 'calls', hour: '10' },
        },
      ]),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getHourlyComparisonRows: jest.fn(),
      getCallFactRows: jest.fn(),
      getTelemarketingBudgetRows: jest.fn(),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
    })

    expect(repository.getSummaryRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-31',
        key: '2026-01-01_2026-01-31',
      },
      received: { count: 12 },
      lost: { count: 4 },
      totalInbound: { count: 16 },
      telemarketingOpenBudgets: { count: 3 },
      peakHour: { hour: '10', totalInboundCount: 7 },
    })
  })

  it('falls back to call facts and telemarketing facts when summary snapshots are empty', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([]),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getHourlyComparisonRows: jest.fn(),
      getCallFactRows: jest.fn().mockResolvedValue([
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
      ]),
      getTelemarketingBudgetRows: jest.fn().mockResolvedValue([
        { budgetDatetime: utcDate(2026, 0, 5, 8, 30), statusNormalized: 'OPEN' },
      ]),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(repository.getCallFactRows).toHaveBeenCalled()
    expect(result).toEqual({
      period: {
        from: '2026-01-05',
        to: '2026-01-05',
        key: '2026-01-05_2026-01-05',
      },
      received: { count: 1 },
      lost: { count: 1 },
      totalInbound: { count: 2 },
      telemarketingOpenBudgets: { count: 1 },
      peakHour: { hour: '08', totalInboundCount: 2 },
    })
  })

  it('returns agent ranking rows with employee label fallback to extension', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn().mockResolvedValue([
        {
          dimensionKey: 'employee:ext-1',
          dimensionLabel: 'Maria',
          metricKey: 'received.count',
          metricValue: '2',
          payloadJson: {
            agentType: 'EMPLOYEE',
            employeeName: 'Maria',
            extensionNumber: '104',
            extensionUuid: 'ext-1',
          },
        },
        {
          dimensionKey: 'employee:ext-1',
          dimensionLabel: 'Maria',
          metricKey: 'lost.count',
          metricValue: '0',
          payloadJson: {
            agentType: 'EMPLOYEE',
            employeeName: 'Maria',
            extensionNumber: '104',
            extensionUuid: 'ext-1',
          },
        },
        {
          dimensionKey: 'extension:107',
          dimensionLabel: '107',
          metricKey: 'received.count',
          metricValue: '0',
          payloadJson: {
            agentType: 'EXTENSION',
            employeeName: null,
            extensionNumber: '107',
            extensionUuid: null,
          },
        },
        {
          dimensionKey: 'extension:107',
          dimensionLabel: '107',
          metricKey: 'lost.count',
          metricValue: '3',
          payloadJson: {
            agentType: 'EXTENSION',
            employeeName: null,
            extensionNumber: '107',
            extensionUuid: null,
          },
        },
      ]),
      getHourlyComparisonRows: jest.fn(),
      getCallFactRows: jest.fn(),
      getTelemarketingBudgetRows: jest.fn(),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getAgentRanking({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result).toEqual({
      period: {
        from: '2026-01-05',
        to: '2026-01-05',
        key: '2026-01-05_2026-01-05',
      },
      rows: [
        {
          agentType: 'EMPLOYEE',
          agentKey: 'employee:ext-1',
          agentLabel: 'Maria',
          employeeName: 'Maria',
          extensionNumber: '104',
          receivedCount: 2,
          lostCount: 0,
          totalInboundCount: 2,
        },
        {
          agentType: 'EXTENSION',
          agentKey: 'extension:107',
          agentLabel: '107',
          employeeName: null,
          extensionNumber: '107',
          receivedCount: 0,
          lostCount: 3,
          totalInboundCount: 3,
        },
      ],
    })
  })

  it('returns a zero-filled hourly comparison series', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getHourlyComparisonRows: jest.fn().mockResolvedValue([
        {
          dimensionKey: '08',
          dimensionLabel: '08',
          metricKey: 'received.count',
          metricValue: '2',
          payloadJson: { hour: '08' },
        },
        {
          dimensionKey: '08',
          dimensionLabel: '08',
          metricKey: 'lost.count',
          metricValue: '1',
          payloadJson: { hour: '08' },
        },
        {
          dimensionKey: '08',
          dimensionLabel: '08',
          metricKey: 'telemarketing_budget.count',
          metricValue: '1',
          payloadJson: { hour: '08' },
        },
        {
          dimensionKey: '10',
          dimensionLabel: '10',
          metricKey: 'received.count',
          metricValue: '3',
          payloadJson: { hour: '10' },
        },
      ]),
      getCallFactRows: jest.fn(),
      getTelemarketingBudgetRows: jest.fn(),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getHourlyComparison({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result.rows).toHaveLength(24)
    expect(result.rows[0]).toEqual({
      hour: '00',
      receivedCount: 0,
      lostCount: 0,
      telemarketingBudgetCount: 0,
    })
    expect(result.rows[8]).toEqual({
      hour: '08',
      receivedCount: 2,
      lostCount: 1,
      telemarketingBudgetCount: 1,
    })
    expect(result.rows[10]).toEqual({
      hour: '10',
      receivedCount: 3,
      lostCount: 0,
      telemarketingBudgetCount: 0,
    })
  })

  it('filters summary facts by extensionUuid with extensionNumber fallback for lost calls', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getHourlyComparisonRows: jest.fn(),
      getCallFactRows: jest.fn().mockResolvedValue([
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
          employeeName: 'Maria',
        },
        {
          id: 3n,
          startedAt: utcDate(2026, 0, 5, 9, 0),
          isInboundToCompany: true,
          isReceived: true,
          isLost: false,
          agentResolutionType: 'EXTENSION_UUID',
          agentResolutionKey: 'ext-2',
          agentExtensionNumber: '107',
          extensionUuid: 'ext-2',
          employeeName: 'Joao',
        },
      ]),
      getTelemarketingBudgetRows: jest.fn().mockResolvedValue([
        { budgetDatetime: utcDate(2026, 0, 5, 8, 30), statusNormalized: 'OPEN' },
      ]),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
      extensionUuid: 'ext-1',
      extensionNumber: '104',
    })

    expect(repository.getSummaryRows).not.toHaveBeenCalled()
    expect(result).toEqual({
      period: {
        from: '2026-01-05',
        to: '2026-01-05',
        key: '2026-01-05_2026-01-05',
      },
      received: { count: 1 },
      lost: { count: 1 },
      totalInbound: { count: 2 },
      telemarketingOpenBudgets: { count: 1 },
      peakHour: { hour: '08', totalInboundCount: 2 },
    })
  })

  it('filters ranking facts by extensionUuid with extensionNumber fallback before grouping', async () => {
    const repository: jest.Mocked<CallKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getHourlyRows: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getHourlyComparisonRows: jest.fn(),
      getCallFactRows: jest.fn().mockResolvedValue([
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
          employeeName: 'Maria',
        },
        {
          id: 3n,
          startedAt: utcDate(2026, 0, 5, 9, 0),
          isInboundToCompany: true,
          isReceived: true,
          isLost: false,
          agentResolutionType: 'EXTENSION_UUID',
          agentResolutionKey: 'ext-2',
          agentExtensionNumber: '107',
          extensionUuid: 'ext-2',
          employeeName: 'Joao',
        },
      ]),
      getTelemarketingBudgetRows: jest.fn(),
    }

    const service = new CallKpiQueryService(repository)

    const result = await service.getAgentRanking({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
      extensionUuid: 'ext-1',
      extensionNumber: '104',
    })

    expect(repository.getAgentRankingRows).not.toHaveBeenCalled()
    expect(result).toEqual({
      period: {
        from: '2026-01-05',
        to: '2026-01-05',
        key: '2026-01-05_2026-01-05',
      },
      rows: [
        {
          agentType: 'EMPLOYEE',
          agentKey: 'employee:ext-1',
          agentLabel: 'Maria',
          employeeName: 'Maria',
          extensionNumber: '104',
          receivedCount: 1,
          lostCount: 1,
          totalInboundCount: 2,
        },
      ],
    })
  })
})
