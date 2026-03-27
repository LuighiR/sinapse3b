import { BudgetKpiQueryService, type BudgetKpiQueryRepository } from './budget-kpi-query.service'

describe('BudgetKpiQueryService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month, day, hour, minute))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('returns budget summary cards for a client period', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([
        { metricKey: 'total.count', metricValue: '10', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'total.value', metricValue: '5000.00', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'won.count', metricValue: '4', dimensionsJson: { status: 'WON' } },
        { metricKey: 'won.value', metricValue: '3200.00', dimensionsJson: { status: 'WON' } },
      ]),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

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
      total: { count: 10, value: '5000.00' },
      open: { count: 0, value: '0.0000' },
      won: { count: 4, value: '3200.00' },
      lost: { count: 0, value: '0.0000' },
    })
  })

  it('falls back to canonical facts when budget summary snapshots are empty', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([]),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 2, 5),
          budgetDatetime: utcDate(2026, 2, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          valueAmount: '6406599.99',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 2, 5),
          budgetDatetime: utcDate(2026, 2, 5, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Pedido Televendas',
          valueAmount: '666087.47',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-03-01',
      to: '2026-03-31',
    })

    expect(repository.getBudgetFactRows).toHaveBeenCalled()
    expect(result.total).toEqual({ count: 2, value: '7072687.4600' })
    expect(result.won).toEqual({ count: 2, value: '7072687.4600' })
    expect(result.open).toEqual({ count: 0, value: '0.0000' })
    expect(result.lost).toEqual({ count: 0, value: '0.0000' })
  })

  it('returns budget summary cards filtered by sellerId from canonical facts', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 2),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          valueAmount: '50.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: '7',
    })

    expect(repository.getSummaryRows).not.toHaveBeenCalled()
    expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      sellerId: 7,
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-31',
        key: '2026-01-01_2026-01-31',
      },
      total: { count: 2, value: '150.0000' },
      open: { count: 1, value: '50.0000' },
      won: { count: 1, value: '100.0000' },
      lost: { count: 0, value: '0.0000' },
    })
  })

  it('returns a zero-filled daily series for each day in the period', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn().mockResolvedValue([
        {
          bucketDate: utcDate(2026, 0, 2),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-02',
          dimensionLabel: '2026-01-02',
          metricKey: 'value',
          metricValue: '200.0000',
          payloadJson: { bucket: '2026-01-02', family: 'budgets' },
          sortOrder: 1,
        },
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'count',
          metricValue: '2',
          payloadJson: { bucket: '2026-01-01', family: 'budgets' },
          sortOrder: 0,
        },
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'value',
          metricValue: '150.0000',
          payloadJson: { bucket: '2026-01-01', family: 'budgets' },
          sortOrder: 1,
        },
      ]),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
    })

    expect(repository.getDailyRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 3),
      }),
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-03',
        key: '2026-01-01_2026-01-03',
      },
      series: [
        { date: '2026-01-01', count: 2, value: '150.0000' },
        { date: '2026-01-02', count: 0, value: '200.0000' },
        { date: '2026-01-03', count: 0, value: '0.0000' },
      ],
    })
  })

  it('falls back to canonical facts when budget daily snapshots are empty', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn().mockResolvedValue([]),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 2, 5),
          budgetDatetime: utcDate(2026, 2, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          valueAmount: '6406599.99',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 2, 5),
          budgetDatetime: utcDate(2026, 2, 5, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Pedido Televendas',
          valueAmount: '666087.47',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-03-05',
      to: '2026-03-06',
    })

    expect(repository.getBudgetFactRows).toHaveBeenCalled()
    expect(result.series).toEqual([
      { date: '2026-03-05', count: 2, value: '7072687.4600' },
      { date: '2026-03-06', count: 0, value: '0.0000' },
    ])
  })

  it('returns a seller-filtered daily series from canonical facts', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 3),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          valueAmount: '25.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
      sellerId: '7',
    })

    expect(repository.getDailyRows).not.toHaveBeenCalled()
    expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 3),
      }),
      sellerId: 7,
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-03',
        key: '2026-01-01_2026-01-03',
      },
      series: [
        { date: '2026-01-01', count: 2, value: '150.0000' },
        { date: '2026-01-02', count: 0, value: '0.0000' },
        { date: '2026-01-03', count: 1, value: '25.0000' },
      ],
    })
  })

  it('returns drilldown rows scoped by seller and branch name', async () => {
    const budgetDatetime = utcDate(2026, 0, 2, 9, 30)
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 99n,
          clientId: 'c1',
          sourceTable: 'ferraco_budgets',
          sourceRecordId: 123,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 2),
          budgetDatetime: utcDate(2026, 0, 2, 9, 30),
          closingDate: null,
          statusNormalized: 'WON',
          channel: null,
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.5000',
          sequential: null,
          davId: 777n,
          sequentialLinkedSale: null,
          payloadJson: { family: 'budgets' },
          createdAt: utcDate(2026, 0, 2),
          updatedAt: utcDate(2026, 0, 2),
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: '7',
      branchName: 'Matriz',
    })

    expect(repository.getDrilldownRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      sellerId: 7,
      branchName: 'Matriz',
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-31',
        key: '2026-01-01_2026-01-31',
      },
      filters: {
        sellerId: 7,
        branchName: 'Matriz',
      },
      rows: [
        {
          id: '99',
          sourceTable: 'ferraco_budgets',
          sourceRecordId: 123,
          budgetDate: '2026-01-02',
          budgetDatetime: budgetDatetime.toISOString(),
          closingDate: null,
          branchId: 5,
          branchName: 'Matriz',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.5000',
          sequential: null,
          davId: '777',
          sequentialLinkedSale: null,
          payloadJson: { family: 'budgets' },
        },
      ],
    })
  })

  it('serializes string-formatted drilldown dates without timezone drift', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: '99',
          clientId: 'c1',
          sourceTable: 'ferraco_budgets',
          sourceRecordId: 123,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: '2026-01-02',
          budgetDatetime: '2026-01-02T09:30:00.000Z',
          closingDate: '2026-01-03',
          statusNormalized: 'WON',
          channel: null,
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.5000',
          sequential: null,
          davId: '777',
          sequentialLinkedSale: null,
          payloadJson: { family: 'budgets' },
        } as any,
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
    })

    expect(result.rows).toEqual([
      {
        id: '99',
        sourceTable: 'ferraco_budgets',
        sourceRecordId: 123,
        budgetDate: '2026-01-02',
        budgetDatetime: '2026-01-02T09:30:00.000Z',
        closingDate: '2026-01-03',
        branchId: 5,
        branchName: 'Matriz',
        sellerId: 7,
        sellerName: 'Maria',
        statusNormalized: 'WON',
        channel: null,
        customerName: 'ACME LTDA',
        cpfCnpj: null,
        valueAmount: '200.5000',
        sequential: null,
        davId: '777',
        sequentialLinkedSale: null,
        payloadJson: { family: 'budgets' },
      },
    ])
  })

  it('filters drilldown rows by status using the budget status query contract', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 99n,
          clientId: 'c1',
          sourceTable: 'ferraco_budgets',
          sourceRecordId: 123,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 2),
          budgetDatetime: utcDate(2026, 0, 2, 9, 30),
          closingDate: null,
          statusNormalized: 'WON',
          channel: null,
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.5000',
          sequential: null,
          davId: 777n,
          sequentialLinkedSale: null,
          payloadJson: { family: 'budgets' },
        },
        {
          id: 100n,
          clientId: 'c1',
          sourceTable: 'ferraco_budgets',
          sourceRecordId: 124,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 2),
          budgetDatetime: utcDate(2026, 0, 2, 10, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: null,
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '80.0000',
          sequential: null,
          davId: 778n,
          sequentialLinkedSale: null,
          payloadJson: { family: 'budgets' },
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: '7',
      status: 'Baixado',
    })

    expect(repository.getDrilldownRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      sellerId: 7,
      branchId: undefined,
      branchName: undefined,
    })
    expect(result.filters).toEqual({
      sellerId: 7,
      status: 'Baixado',
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.statusNormalized).toBe('WON')
  })

  it('rejects invalid sellerId values before querying drilldown rows', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    await expect(
      service.getDrilldown({
        clientId: 'c1',
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: 'abc',
      }),
    ).rejects.toThrow('Invalid sellerId: abc')

    expect(repository.getDrilldownRows).not.toHaveBeenCalled()
  })

  it('rejects sellerId values outside the safe integer range', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    await expect(
      service.getDrilldown({
        clientId: 'c1',
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: 9007199254740993n,
      }),
    ).rejects.toThrow('Invalid sellerId: 9007199254740993')

    expect(repository.getDrilldownRows).not.toHaveBeenCalled()
  })

  it('filters summary by status and orderType from canonical facts', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          budgetDatetime: utcDate(2026, 0, 1, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Balcao',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 1),
          budgetDatetime: utcDate(2026, 0, 1, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 1),
          budgetDatetime: utcDate(2026, 0, 1, 12, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          valueAmount: '75.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      status: 'Baixado',
      orderType: 'Balcao',
    })

    expect(result.total).toEqual({ count: 1, value: '100.0000' })
    expect(result.won).toEqual({ count: 1, value: '100.0000' })
    expect(result.open).toEqual({ count: 0, value: '0.0000' })
    expect(result.lost).toEqual({ count: 0, value: '0.0000' })
  })

  it('returns follow-up summary as of the frontend reference timestamp', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
          closingDate: utcDate(2026, 0, 5),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Balcao',
          valueAmount: '100.00',
          payloadJson: { closing_time: '12:00:00' },
        },
        {
          id: 2n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T09:00:00-03:00'),
          closingDate: utcDate(2026, 0, 6),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          valueAmount: '50.00',
          payloadJson: { closing_time: '08:30:00' },
        },
        {
          id: 3n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T13:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: 'Televendas',
          valueAmount: '80.00',
          payloadJson: {},
        },
        {
          id: 4n,
          budgetDate: new Date('2026-01-04T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-04T08:00:00-03:00'),
          closingDate: utcDate(2026, 0, 6),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Televendas',
          valueAmount: '200.00',
          payloadJson: { closing_time: '18:00:00' },
        },
        {
          id: 5n,
          budgetDate: new Date('2026-01-04T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-04T07:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: null,
          valueAmount: '25.00',
          payloadJson: {},
        },
        {
          id: 6n,
          budgetDate: new Date('2026-01-06T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-06T15:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          valueAmount: '999.00',
          payloadJson: {},
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-06',
      referenceAt: '2026-01-06T09:00:00-03:00',
    })

    expect(result).toEqual({
      period: {
        from: '2026-01-01',
        to: '2026-01-06',
        key: '2026-01-01_2026-01-06',
      },
      total: { count: 5, value: '455.0000' },
      within24h: {
        total: { count: 3, value: '230.0000' },
        converted: { count: 1, value: '100.0000', percentage: '20.00' },
        lost: { count: 1, value: '50.0000', percentage: '20.00' },
        open: { count: 1, value: '80.0000', percentage: '20.00' },
      },
      after24h: {
        total: { count: 2, value: '225.0000' },
        converted: { count: 0, value: '0.0000', percentage: '0.00' },
        lost: { count: 0, value: '0.0000', percentage: '0.00' },
        open: { count: 2, value: '225.0000', percentage: '40.00' },
      },
    })
  })

  it('returns a zero-filled hourly series sorted from 00 to 23', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 45),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Balcao',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 10, 10),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          valueAmount: '25.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getHourlySeries({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result.series).toHaveLength(24)
    expect(result.series[0]).toEqual({ hour: '00', count: 0, value: '0.0000' })
    expect(result.series[8]).toEqual({ hour: '08', count: 2, value: '150.0000' })
    expect(result.series[10]).toEqual({ hour: '10', count: 1, value: '25.0000' })
    expect(result.series[23]).toEqual({ hour: '23', count: 0, value: '0.0000' })
  })

  it('returns channel daily rows with null orderType labeled as Nao identificado', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: null,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Televendas',
          valueAmount: '50.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getChannelDaily({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result.rows).toEqual([
      { date: '2026-01-05', orderType: 'Nao identificado', count: 1, value: '100.0000' },
      { date: '2026-01-05', orderType: 'Televendas', count: 1, value: '50.0000' },
    ])
  })

  it('returns channel hourly rows grouped by hour and orderType', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: null,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 45),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: null,
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Televendas',
          valueAmount: '25.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getChannelHourly({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result.rows).toEqual([
      { hour: '08', orderType: 'Nao identificado', count: 2, value: '150.0000' },
      { hour: '10', orderType: 'Televendas', count: 1, value: '25.0000' },
    ])
  })

  it('returns abandonment by channel using cancelados only', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: null,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 45),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: 'Televendas',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Televendas',
          valueAmount: '25.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getChannelAbandonment({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
    })

    expect(result.rows).toEqual([
      { orderType: 'Nao identificado', count: 1, value: '100.0000' },
      { orderType: 'Televendas', count: 1, value: '50.0000' },
    ])
  })
})
