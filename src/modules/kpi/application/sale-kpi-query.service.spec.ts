import { SaleKpiQueryService, type SaleKpiQueryRepository } from './sale-kpi-query.service'

describe('SaleKpiQueryService', () => {
  const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month, day, hour, minute))
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('returns sales summary cards for a client period', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([
        { metricKey: 'total.count', metricValue: '10', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'total.value', metricValue: '5000.00', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'active.count', metricValue: '9', dimensionsJson: { status: 'ACTIVE' } },
        { metricKey: 'active.value', metricValue: '4800.00', dimensionsJson: { status: 'ACTIVE' } },
        { metricKey: 'canceled.count', metricValue: '1', dimensionsJson: { status: 'CANCELED' } },
        { metricKey: 'canceled.value', metricValue: '200.00', dimensionsJson: { status: 'CANCELED' } },
        { metricKey: 'average_daily.count', metricValue: '0.3226', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'average_daily.value', metricValue: '161.2903', dimensionsJson: { status: 'TOTAL' } },
        { metricKey: 'average_ticket.value', metricValue: '500.00', dimensionsJson: { status: 'TOTAL' } },
      ]),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

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
      active: { count: 9, value: '4800.00' },
      canceled: { count: 1, value: '200.00' },
      averageDaily: { count: '0.3226', value: '161.2903' },
      averageTicket: { value: '500.00' },
    })
  })

  it('falls back to canonical facts when summary snapshots are empty', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn().mockResolvedValue([]),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 2, 5),
          saleDatetime: utcDate(2026, 2, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '6406599.99',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 2, 5),
          saleDatetime: utcDate(2026, 2, 5, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Pedido Televendas',
          valueAmount: '666087.47',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-03-01',
      to: '2026-03-31',
    })

    expect(repository.getSaleFactRows).toHaveBeenCalled()
    expect(result.total).toEqual({ count: 2, value: '7072687.4600' })
    expect(result.active).toEqual({ count: 2, value: '7072687.4600' })
    expect(result.canceled).toEqual({ count: 0, value: '0.0000' })
  })

  it('filters sales summary by status and orderType from canonical facts', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 0, 1),
          saleDatetime: utcDate(2026, 0, 1, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Balcao',
          valueAmount: '100.00',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 0, 1),
          saleDatetime: utcDate(2026, 0, 1, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'CANCELED',
          channel: 'Balcao',
          valueAmount: '50.00',
        },
        {
          id: 3n,
          saleDate: utcDate(2026, 0, 1),
          saleDatetime: utcDate(2026, 0, 1, 12, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '75.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      status: 'Ativa',
      orderType: 'Balcao',
    })

    expect(result.total).toEqual({ count: 1, value: '100.0000' })
    expect(result.active).toEqual({ count: 1, value: '100.0000' })
    expect(result.canceled).toEqual({ count: 0, value: '0.0000' })
    expect(result.averageDaily).toEqual({ count: '0.0323', value: '3.2258' })
    expect(result.averageTicket).toEqual({ value: '100.0000' })
  })

  it('filters sales summary by hasLinkedBudget from canonical facts', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 0, 1),
          saleDatetime: utcDate(2026, 0, 1, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Balcao',
          hasLinkedBudget: true,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 0, 1),
          saleDatetime: utcDate(2026, 0, 1, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'CANCELED',
          channel: 'Balcao',
          hasLinkedBudget: false,
          valueAmount: '50.00',
        },
        {
          id: 3n,
          saleDate: utcDate(2026, 0, 2),
          saleDatetime: utcDate(2026, 0, 2, 12, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          hasLinkedBudget: false,
          valueAmount: '75.00',
        },
      ] as any),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
      hasLinkedBudget: true,
    })

    expect(result.total).toEqual({ count: 1, value: '100.0000' })
    expect(result.active).toEqual({ count: 1, value: '100.0000' })
    expect(result.canceled).toEqual({ count: 0, value: '0.0000' })
    expect(result.averageDaily).toEqual({ count: '0.0323', value: '3.2258' })
    expect(result.averageTicket).toEqual({ value: '100.0000' })
  })

  it('returns a zero-filled daily series for each day in the period', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn().mockResolvedValue([
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'count',
          metricValue: '2',
          payloadJson: { bucket: '2026-01-01', family: 'sales' },
          sortOrder: 0,
        },
        {
          bucketDate: utcDate(2026, 0, 1),
          dimensionType: 'DAY',
          dimensionKey: '2026-01-01',
          dimensionLabel: '2026-01-01',
          metricKey: 'value',
          metricValue: '150.0000',
          payloadJson: { bucket: '2026-01-01', family: 'sales' },
          sortOrder: 1,
        },
      ]),
      getSaleFactRows: jest.fn(),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-03',
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
        { date: '2026-01-03', count: 0, value: '0.0000' },
      ],
    })
  })

  it('falls back to canonical facts when daily snapshots are empty', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn().mockResolvedValue([]),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 2, 5),
          saleDatetime: utcDate(2026, 2, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '6406599.99',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 2, 5),
          saleDatetime: utcDate(2026, 2, 5, 11, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Pedido Televendas',
          valueAmount: '666087.47',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getDailySeries({
      clientId: 'c1',
      from: '2026-03-05',
      to: '2026-03-06',
    })

    expect(repository.getSaleFactRows).toHaveBeenCalled()
    expect(result.series).toEqual([
      { date: '2026-03-05', count: 2, value: '7072687.4600' },
      { date: '2026-03-06', count: 0, value: '0.0000' },
    ])
  })

  it('returns sales by channel per day with null channels labeled as Nao identificado', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: utcDate(2026, 0, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Televendas',
          valueAmount: '50.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

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

  it('returns ticket average overall and by channel', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn().mockResolvedValue([
        {
          id: 1n,
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: utcDate(2026, 0, 5, 8, 15),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '100.00',
        },
        {
          id: 2n,
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: utcDate(2026, 0, 5, 8, 45),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: null,
          valueAmount: '50.00',
        },
        {
          id: 3n,
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: utcDate(2026, 0, 5, 10, 0),
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'VALID',
          channel: 'Televendas',
          valueAmount: '25.00',
        },
      ]),
      getDrilldownRows: jest.fn(),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getTicketAverage({
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
      overall: {
        count: 3,
        value: '175.0000',
        averageTicket: '58.3333',
      },
      channels: [
        { orderType: 'Nao identificado', count: 2, value: '150.0000', averageTicket: '75.0000' },
        { orderType: 'Televendas', count: 1, value: '25.0000', averageTicket: '25.0000' },
      ],
    })
  })

  it('returns drilldown rows with filters applied and newest records first', async () => {
    const repository: jest.Mocked<SaleKpiQueryRepository> = {
      getSummaryRows: jest.fn(),
      getDailyRows: jest.fn(),
      getSaleFactRows: jest.fn(),
      getDrilldownRows: jest.fn().mockResolvedValue([
        {
          id: 10n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 321,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: '2026-01-05T09:00:00.000Z',
          statusNormalized: 'CANCELED',
          channel: 'Televendas',
          hasLinkedBudget: true,
          linkedBudgetSourceRecordId: 98,
          customerName: 'ACME LTDA',
          cpfCnpj: '12345678900',
          valueAmount: '80.5000',
          sequential: 999n,
          invoiceSerie: 4n,
          invoiceNumeric: 77n,
          listDavsId: '1,2',
          payloadJson: { family: 'sales' },
        },
        {
          id: 11n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 654,
          branchName: 'Matriz',
          branchId: 5,
          sellerId: 7,
          sellerName: 'Maria',
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: '2026-01-05T14:30:00.000Z',
          statusNormalized: 'CANCELED',
          channel: 'Televendas',
          hasLinkedBudget: true,
          linkedBudgetSourceRecordId: null,
          customerName: 'Globex',
          cpfCnpj: null,
          valueAmount: '120.0000',
          sequential: null,
          invoiceSerie: null,
          invoiceNumeric: null,
          listDavsId: null,
          payloadJson: null,
        },
        {
          id: 12n,
          clientId: 'c1',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 777,
          branchName: 'Filial',
          branchId: 8,
          sellerId: 9,
          sellerName: 'Joao',
          saleDate: utcDate(2026, 0, 5),
          saleDatetime: '2026-01-05T16:00:00.000Z',
          statusNormalized: 'VALID',
          channel: 'Balcao',
          hasLinkedBudget: false,
          linkedBudgetSourceRecordId: null,
          customerName: 'Umbrella',
          cpfCnpj: null,
          valueAmount: '300.0000',
          sequential: 123n,
          invoiceSerie: 9n,
          invoiceNumeric: 10n,
          listDavsId: null,
          payloadJson: null,
        },
      ]),
    }

    const service = new SaleKpiQueryService(repository)

    const result = await service.getDrilldown({
      clientId: 'c1',
      from: '2026-01-05',
      to: '2026-01-05',
      sellerId: 7,
      status: 'Cancelada',
      orderType: 'Televendas',
      hasLinkedBudget: true,
    })

    expect(repository.getDrilldownRows).toHaveBeenCalledWith({
      clientId: 'c1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 0, 5),
        to: saoPauloPeriodDate(2026, 0, 5),
      }),
      sellerId: 7,
    })
    expect(result).toEqual({
      period: {
        from: '2026-01-05',
        to: '2026-01-05',
        key: '2026-01-05_2026-01-05',
      },
      filters: {
        sellerId: 7,
        status: 'Cancelada',
        orderType: 'Televendas',
        hasLinkedBudget: true,
      },
      rows: [
        {
          id: '11',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 654,
          saleDate: '2026-01-05',
          saleDatetime: '2026-01-05T14:30:00.000Z',
          branchId: 5,
          branchName: 'Matriz',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'CANCELED',
          channel: 'Televendas',
          hasLinkedBudget: true,
          linkedBudgetSourceRecordId: null,
          customerName: 'Globex',
          cpfCnpj: null,
          valueAmount: '120.0000',
          sequential: null,
          invoiceSerie: null,
          invoiceNumeric: null,
          listDavsId: null,
          payloadJson: null,
        },
        {
          id: '10',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 321,
          saleDate: '2026-01-05',
          saleDatetime: '2026-01-05T09:00:00.000Z',
          branchId: 5,
          branchName: 'Matriz',
          sellerId: 7,
          sellerName: 'Maria',
          statusNormalized: 'CANCELED',
          channel: 'Televendas',
          hasLinkedBudget: true,
          linkedBudgetSourceRecordId: 98,
          customerName: 'ACME LTDA',
          cpfCnpj: '12345678900',
          valueAmount: '80.5000',
          sequential: '999',
          invoiceSerie: '4',
          invoiceNumeric: '77',
          listDavsId: '1,2',
          payloadJson: { family: 'sales' },
        },
      ],
    })
  })
})
