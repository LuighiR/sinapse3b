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

  it('returns budget summary cards filtered by branchId from canonical facts', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          sellerId: 7,
          sellerName: 'Maria',
          branchId: 5,
          statusNormalized: 'WON',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 2),
          sellerId: 7,
          sellerName: 'Maria',
          branchId: 5,
          statusNormalized: 'OPEN',
          valueAmount: '50.00',
        },
      ] as any),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: '5',
    })

    expect(repository.getSummaryRows).not.toHaveBeenCalled()
    expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      branchId: 5,
    })
    expect(result.total).toEqual({ count: 2, value: '150.0000' })
    expect(result.open).toEqual({ count: 1, value: '50.0000' })
    expect(result.won).toEqual({ count: 1, value: '100.0000' })
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

  it('returns a branch-filtered daily series from canonical facts', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: utcDate(2026, 0, 1),
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          budgetDate: utcDate(2026, 0, 3),
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          valueAmount: '25.00',
        },
      ] as any),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
      branchId: '5',
    })

    expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 3),
      }),
      branchId: 5,
    })
    expect(result.series).toEqual([
      { date: '2026-01-01', count: 1, value: '100.0000' },
      { date: '2026-01-02', count: 0, value: '0.0000' },
      { date: '2026-01-03', count: 1, value: '25.0000' },
    ])
  })

  it('validates branch scope before querying budget summary rows', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([]),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([]),
      getDrilldownRows: jest.fn(),
    }
    const branchScopeService = {
      assertBranchScope: jest.fn().mockRejectedValue(new Error('Branch is outside the active client scope')),
    }

    const service = new (BudgetKpiQueryService as any)(repository, branchScopeService)

    await expect(
      service.getSummary({
        clientId: 'c1',
        from: '2026-01-01',
        to: '2026-01-31',
        branchId: '9',
      }),
    ).rejects.toThrow('Branch is outside the active client scope')

    expect(branchScopeService.assertBranchScope).toHaveBeenCalledWith('c1', 9)
    expect(repository.getSummaryRows).not.toHaveBeenCalled()
  })

  it('returns drilldown rows scoped by seller, branch, and branch name', async () => {
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
      branchId: '5',
      branchName: 'Matriz',
    })

    expect(repository.getDrilldownRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      sellerId: 7,
      branchId: 5,
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
        branchId: 5,
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
          cancellationDate: null,
          cancelationTime: null,
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
          cancellationDate: '2026-01-04',
          cancelationTime: '14:45:00',
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
        cancellationDate: '2026-01-04',
        cancelationTime: '14:45:00',
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

  it('filters and orders follow-up drilldown rows by date window and status', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 302n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 302,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 6, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '180.0000',
          sequential: null,
          davId: 778n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
        {
          id: 304n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 304,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 22, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '90.0000',
          sequential: null,
          davId: 780n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
        {
          id: 305n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 305,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 9, 0),
          closingDate: utcDate(2026, 0, 5),
          statusNormalized: 'WON',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '220.0000',
          sequential: null,
          davId: 779n,
          sequentialLinkedSale: null,
          payloadJson: { closing_time: '10:00:00' },
        },
        {
          id: 301n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 301,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.0000',
          sequential: null,
          davId: 777n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
        {
          id: 303n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 303,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 4),
          budgetDatetime: utcDate(2026, 0, 4, 8, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '75.0000',
          sequential: null,
          davId: 781n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
        {
          id: 306n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 306,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 7, 30),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Televendas',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '65.0000',
          sequential: null,
          davId: 782n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T18:30:00-03:00',
      date: '2026-01-05',
      followUpWindow: 'after24h',
      followUpStatus: 'open',
      sellerId: '7',
      branchId: '5',
      orderType: 'Balcao',
    })

    expect(repository.getDrilldownRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 1),
        to: saoPauloPeriodDate(2026, 0, 31),
      }),
      sellerId: 7,
      branchId: 5,
      branchName: undefined,
    })
    expect(result.filters).toEqual({
      referenceAt: '2026-01-06T18:30:00-03:00',
      date: '2026-01-05',
      followUpWindow: 'after24h',
      followUpStatus: 'open',
      sellerId: 7,
      branchId: 5,
      orderType: 'Balcao',
    })
    expect(result.rows).toHaveLength(2)
    expect(result.rows.map(({ id }) => id)).toEqual(['301', '302'])
    expect(result.rows[0]).toMatchObject({
      id: '301',
      budgetDate: '2026-01-05',
      budgetDatetime: utcDate(2026, 0, 5, 8, 0).toISOString(),
      followUpWindow: 'after24h',
      followUpStatus: 'open',
    })
    expect(result.rows[1]).toMatchObject({
      id: '302',
      budgetDate: '2026-01-05',
      budgetDatetime: utcDate(2026, 0, 5, 6, 0).toISOString(),
      followUpWindow: 'after24h',
      followUpStatus: 'open',
    })
    expect(result.rows).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: '306' })]),
    )
  })

  it('orders follow-up drilldown rows by id when budgetDatetime and budgetDate tie', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 2n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 2,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '20.0000',
          sequential: null,
          davId: 2n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
        {
          id: 10n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 10,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 0),
          closingDate: null,
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '30.0000',
          sequential: null,
          davId: 10n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T18:30:00-03:00',
    })

    expect(result.rows.map((row) => row.id)).toEqual(['10', '2'])
  })

  it('classifies cancelled follow-up drilldown rows from structured cancellation fields', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 901n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 901,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T09:00:00-03:00'),
          closingDate: null,
          cancellationDate: new Date('2026-01-05T00:00:00-03:00'),
          cancelationTime: '11:00:00',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '125.0000',
          sequential: null,
          davId: 901n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T09:00:00-03:00',
      date: '2026-01-05',
      followUpWindow: 'within24h',
      followUpStatus: 'lost',
      orderType: 'Balcao',
    })

    expect(result.rows).toEqual([
      expect.objectContaining({
        id: '901',
        cancellationDate: '2026-01-05',
        cancelationTime: '11:00:00',
        followUpWindow: 'within24h',
        followUpStatus: 'lost',
      }),
    ])
  })

  it('keeps rows without resolvable closure as open in follow-up drilldown', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 401n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 401,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          budgetDate: utcDate(2026, 0, 5),
          budgetDatetime: utcDate(2026, 0, 5, 8, 0),
          closingDate: null,
          statusNormalized: 'WON',
          channel: 'Balcao',
          customerName: 'ACME LTDA',
          cpfCnpj: null,
          valueAmount: '200.0000',
          sequential: null,
          davId: 777n,
          sequentialLinkedSale: null,
          payloadJson: {},
        },
      ]),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDrilldown({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30:00-03:00',
      followUpStatus: 'open',
    })

    expect(result.rows[0]).toMatchObject({
      id: '401',
      followUpStatus: 'open',
    })
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
          cancellationDate: new Date('2026-01-05T00:00:00-03:00'),
          cancelationTime: '10:30:00',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          valueAmount: '50.00',
          payloadJson: {},
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

  it('treats won budgets without closing_time as converted by end of closing day in follow-up summary', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
          closingDate: new Date('2026-01-05T00:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          valueAmount: '100.00',
          payloadJson: {},
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-06T09:00:00-03:00',
    })

    expect(result.within24h.converted.count).toBe(1)
    expect(result.within24h.open.count).toBe(0)
  })

  it('returns zero-filled follow-up daily rows for all six groups', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
          closingDate: new Date('2026-01-05T00:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'WON',
          channel: 'Balcao',
          valueAmount: '100.00',
          payloadJson: {},
        },
        {
          id: 2n,
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-05T11:00:00-03:00'),
          cancellationDate: new Date('2026-01-05T00:00:00-03:00'),
          cancelationTime: '12:00:00',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'LOST',
          channel: 'Balcao',
          valueAmount: '25.00',
          payloadJson: {},
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDaily({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-06',
      referenceAt: '2026-01-06T09:00:00-03:00',
      branchId: '5',
      sellerId: '7',
      orderType: 'Balcao',
    })

    expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 5),
        to: saoPauloPeriodDate(2026, 0, 6),
      }),
      branchId: 5,
      sellerId: 7,
    })
    expect(result.rows).toHaveLength(12)
    expect(result.rows).toEqual([
      { date: '2026-01-05', window: 'within24h', status: 'converted', count: 1, value: '100.0000' },
      { date: '2026-01-05', window: 'within24h', status: 'lost', count: 1, value: '25.0000' },
      { date: '2026-01-05', window: 'within24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'open', count: 0, value: '0.0000' },
    ])
  })

  it('excludes budgets opened after referenceAt from follow-up daily rows', async () => {
    const repository: jest.Mocked<BudgetKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getBudgetFactRows: jest.fn().mockResolvedValue([
        {
          id: 2n,
          budgetDate: new Date('2026-01-06T00:00:00-03:00'),
          budgetDatetime: new Date('2026-01-06T12:00:00-03:00'),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'OPEN',
          channel: 'Balcao',
          valueAmount: '55.00',
          payloadJson: {},
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new BudgetKpiQueryService(repository)

    const result = await service.getFollowUpDaily({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-06',
      referenceAt: '2026-01-06T09:00:00-03:00',
    })

    expect(result.rows).toHaveLength(12)
    expect(result.rows).toEqual([
      { date: '2026-01-05', window: 'within24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'within24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'within24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-05', window: 'after24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'within24h', status: 'open', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'converted', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'lost', count: 0, value: '0.0000' },
      { date: '2026-01-06', window: 'after24h', status: 'open', count: 0, value: '0.0000' },
    ])
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
