import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt, ensureTestEnv } from './helpers/fakes'
import {
  SaleKpiQueryService,
  type SaleKpiChannelDailyResponse,
  type SaleKpiDailySeriesResponse,
  type SaleKpiSummaryResponse,
  type SaleKpiTicketAverageResponse,
} from '../src/modules/kpi/application/sale-kpi-query.service'
import { SaleKpiRefreshService, type SaleKpiRefreshResult } from '../src/modules/kpi/application/sale-kpi-refresh.service'

describe('Sale KPI endpoints', () => {
  let app: INestApplication
  let token: string
  let queryService: SaleKpiQueryService
  let refreshService: SaleKpiRefreshService

  beforeAll(async () => {
    ensureTestEnv()
    token = await buildJwt({ sub: 'user-1' })

    app = await buildTestApp({
      users: [{ id: 'user-1', email: 'user@example.com', name: 'User One', isActive: true }],
      memberships: [{ userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', isActive: true }],
      tenants: [{ id: 'tenant-1', name: 'Tenant 1', slug: 'tenant-1', backendClientId: 'client-1', isActive: true }],
      clients: [{ id: 'client-1', name: 'Client 1', slug: 'client-1', isActive: true }],
    })

    queryService = app.get(SaleKpiQueryService)
    refreshService = app.get(SaleKpiRefreshService)

    jest.spyOn(queryService, 'getSummary').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      total: { count: 3, value: '300.0000' },
      active: { count: 2, value: '250.0000' },
      canceled: { count: 1, value: '50.0000' },
      averageDaily: { count: '0.0968', value: '9.6774' },
      averageTicket: { value: '100.0000' },
    } satisfies SaleKpiSummaryResponse)
    jest.spyOn(queryService, 'getDailySeries').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      series: [
        { date: '2026-01-01', count: 1, value: '100.0000' },
        { date: '2026-01-02', count: 2, value: '200.0000' },
      ],
    } satisfies SaleKpiDailySeriesResponse)
    jest.spyOn(queryService, 'getChannelDaily').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      rows: [
        { date: '2026-01-01', orderType: 'Nao identificado', count: 1, value: '100.0000' },
        { date: '2026-01-01', orderType: 'Televendas', count: 1, value: '120.0000' },
      ],
    } satisfies SaleKpiChannelDailyResponse)
    jest.spyOn(queryService, 'getTicketAverage').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      overall: { count: 3, value: '300.0000', averageTicket: '100.0000' },
      channels: [
        { orderType: 'Nao identificado', count: 1, value: '100.0000', averageTicket: '100.0000' },
      ],
    } satisfies SaleKpiTicketAverageResponse)
    jest.spyOn(refreshService, 'refresh').mockResolvedValue({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      calculationRunId: 'run-1',
      recordsRead: 3,
      snapshotsCreated: 9,
      breakdownsCreated: 6,
      availabilityEnabled: true,
    } satisfies SaleKpiRefreshResult)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('returns the sales summary for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/sales/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        total: { count: 3, value: '300.0000' },
        active: { count: 2, value: '250.0000' },
        canceled: { count: 1, value: '50.0000' },
        averageDaily: { count: '0.0968', value: '9.6774' },
        averageTicket: { value: '100.0000' },
      })
  })

  it('passes sales filters through the summary endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/sales/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', sellerId: '7', status: 'Cancelada', orderType: 'Televendas' })
      .expect(200)

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: 7,
      status: 'Cancelada',
      orderType: 'Televendas',
    })
  })

  it('returns sales daily and ticket-average endpoints', async () => {
    await request(app.getHttpServer())
      .get('/kpis/sales/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)

    await request(app.getHttpServer())
      .get('/kpis/sales/channel/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', status: 'Ativa' })
      .expect(200)

    await request(app.getHttpServer())
      .get('/kpis/sales/ticket-average')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
  })

  it('refreshes the sales kpis for the active tenant client', async () => {
    await request(app.getHttpServer())
      .post('/kpis/sales/refresh')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)

    expect(refreshService.refresh).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })
})
