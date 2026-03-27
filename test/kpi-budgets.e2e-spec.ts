import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import {
  type BudgetKpiFollowUpSummaryResponse,
  BudgetKpiQueryService,
  type BudgetKpiDailySeriesResponse,
  type BudgetKpiDrilldownResponse,
  type BudgetKpiSummaryResponse,
} from '../src/modules/kpi/application/budget-kpi-query.service'
import {
  BudgetKpiRefreshService,
  type BudgetKpiRefreshResult,
} from '../src/modules/kpi/application/budget-kpi-refresh.service'
import { buildJwt, ensureTestEnv } from './helpers/fakes'

describe('Budget KPI endpoints', () => {
  let app: INestApplication
  let token: string
  let queryService: BudgetKpiQueryService
  let refreshService: BudgetKpiRefreshService
  const tenantOne = 'tenant-1'
  const tenantTwo = 'tenant-2'

  beforeAll(async () => {
    ensureTestEnv()
    token = await buildJwt({ sub: 'user-1' })

    app = await buildTestApp({
      users: [{ id: 'user-1', email: 'user@example.com', name: 'User One', isActive: true }],
      memberships: [
        { userId: 'user-1', tenantId: tenantOne, role: 'ADMIN', isActive: true },
        { userId: 'user-1', tenantId: tenantTwo, role: 'VIEWER', isActive: true },
      ],
      tenants: [
        { id: tenantOne, name: 'Tenant 1', slug: 'tenant-1', backendClientId: 'client-1', isActive: true },
        { id: tenantTwo, name: 'Tenant 2', slug: 'tenant-2', backendClientId: 'client-2', isActive: true },
      ],
      clients: [
        { id: 'client-1', name: 'Client 1', slug: 'client-1', isActive: true },
        { id: 'client-2', name: 'Client 2', slug: 'client-2', isActive: true },
      ],
    })

    queryService = app.get(BudgetKpiQueryService)
    refreshService = app.get(BudgetKpiRefreshService)

    jest.spyOn(queryService, 'getSummary').mockImplementation(async ({ clientId }) => {
      if (clientId === 'client-2') {
        return {
          period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
          total: { count: 9, value: '900.0000' },
          open: { count: 2, value: '200.0000' },
          won: { count: 4, value: '400.0000' },
          lost: { count: 3, value: '300.0000' },
        }
      }

      return {
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        total: { count: 3, value: '300.0000' },
        open: { count: 1, value: '100.0000' },
        won: { count: 1, value: '120.0000' },
        lost: { count: 1, value: '80.0000' },
      }
    })
    jest.spyOn(queryService, 'getDailySeries').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      series: [
        { date: '2026-01-01', count: 1, value: '100.0000' },
        { date: '2026-01-02', count: 2, value: '200.0000' },
      ],
    })
    jest.spyOn(queryService, 'getFollowUpSummary').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      total: { count: 6, value: '630.0000' },
      within24h: {
        total: { count: 3, value: '300.0000' },
        converted: { count: 1, value: '120.0000', percentage: '16.67' },
        lost: { count: 1, value: '80.0000', percentage: '16.67' },
        open: { count: 1, value: '100.0000', percentage: '16.67' },
      },
      after24h: {
        total: { count: 3, value: '330.0000' },
        converted: { count: 2, value: '240.0000', percentage: '33.33' },
        lost: { count: 1, value: '90.0000', percentage: '16.67' },
        open: { count: 0, value: '0.0000', percentage: '0.00' },
      },
    } satisfies BudgetKpiFollowUpSummaryResponse)
    jest.spyOn(queryService, 'getDrilldown').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      filters: { sellerId: 7, branchId: 5, branchName: 'Matriz' },
      rows: [
        {
          id: '99',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 123,
          budgetDate: '2026-01-02',
          budgetDatetime: '2026-01-02T09:30:00.000Z',
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
    jest.spyOn(refreshService, 'refresh').mockResolvedValue({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      calculationRunId: 'run-1',
      recordsRead: 3,
      snapshotsCreated: 8,
      breakdownsCreated: 12,
      availabilityEnabled: true,
    })
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('requires the auth and tenant guards', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(401)

    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(400)
  })

  it('returns the budget summary for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        total: { count: 3, value: '300.0000' },
        open: { count: 1, value: '100.0000' },
        won: { count: 1, value: '120.0000' },
        lost: { count: 1, value: '80.0000' },
      })

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('passes sellerId through the summary endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', sellerId: '7' })
      .expect(200)

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: 7,
    })
  })

  it('resolves the client from X-Tenant-Id when the user has multiple memberships', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantTwo)
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        total: { count: 9, value: '900.0000' },
        open: { count: 2, value: '200.0000' },
        won: { count: 4, value: '400.0000' },
        lost: { count: 3, value: '300.0000' },
      })

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-2',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('returns the budget daily series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        series: [
          { date: '2026-01-01', count: 1, value: '100.0000' },
          { date: '2026-01-02', count: 2, value: '200.0000' },
        ],
      })

    expect(queryService.getDailySeries).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('answers the dashboard preflight request with CORS headers', async () => {
    await request(app.getHttpServer())
      .options('/kpis/budgets/daily')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization, X-Tenant-Id')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3001')
  })

  it('passes sellerId through the daily endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', sellerId: '7' })
      .expect(200)

    expect(queryService.getDailySeries).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: 7,
    })
  })

  it('returns the budget follow-up summary for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/follow-up/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', referenceAt: '2026-01-31T18:30:00-03:00' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        total: { count: 6, value: '630.0000' },
        within24h: {
          total: { count: 3, value: '300.0000' },
          converted: { count: 1, value: '120.0000', percentage: '16.67' },
          lost: { count: 1, value: '80.0000', percentage: '16.67' },
          open: { count: 1, value: '100.0000', percentage: '16.67' },
        },
        after24h: {
          total: { count: 3, value: '330.0000' },
          converted: { count: 2, value: '240.0000', percentage: '33.33' },
          lost: { count: 1, value: '90.0000', percentage: '16.67' },
          open: { count: 0, value: '0.0000', percentage: '0.00' },
        },
      })

    expect(queryService.getFollowUpSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30:00-03:00',
    })
  })

  it('rejects follow-up summary without referenceAt', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/follow-up/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(400)
  })

  it('returns drilldown rows scoped by the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/drilldown')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: '7',
        branchId: '5',
        branchName: 'Matriz',
      })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        filters: { sellerId: 7, branchId: 5, branchName: 'Matriz' },
        rows: [
          {
            id: '99',
            sourceTable: 'raw.ferraco_budgets',
            sourceRecordId: 123,
            budgetDate: '2026-01-02',
            budgetDatetime: '2026-01-02T09:30:00.000Z',
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

    expect(queryService.getDrilldown).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: 7,
      branchId: 5,
      branchName: 'Matriz',
    })
  })

  it('rejects oversized drilldown numeric filters with 400', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/drilldown')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: '9007199254740993',
      })
      .expect(400)

    await request(app.getHttpServer())
      .get('/kpis/budgets/drilldown')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({
        from: '2026-01-01',
        to: '2026-01-31',
        branchId: '9007199254740993',
      })
      .expect(400)
  })

  it('rejects invalid date ranges with 400', async () => {
    await request(app.getHttpServer())
      .get('/kpis/budgets/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-31', to: '2026-01-01' })
      .expect(400)
  })

  it('refreshes the budget kpis for the active tenant client', async () => {
    await request(app.getHttpServer())
      .post('/kpis/budgets/refresh')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        clientId: 'client-1',
        from: '2026-01-01',
        to: '2026-01-31',
        calculationRunId: 'run-1',
        recordsRead: 3,
        snapshotsCreated: 8,
        breakdownsCreated: 12,
        availabilityEnabled: true,
      })

    expect(refreshService.refresh).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })
})
