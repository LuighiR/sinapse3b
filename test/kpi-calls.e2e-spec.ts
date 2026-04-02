import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import {
  CallKpiQueryService,
  type CallKpiAgentRankingResponse,
  type CallKpiHourlyComparisonResponse,
  type CallKpiHourlyResponse,
  type CallKpiSummaryResponse,
} from '../src/modules/kpi/application/call-kpi-query.service'
import { CallKpiRefreshService, type CallKpiRefreshResult } from '../src/modules/kpi/application/call-kpi-refresh.service'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt, ensureTestEnv } from './helpers/fakes'

describe('Call KPI endpoints', () => {
  let app: INestApplication
  let token: string
  let queryService: CallKpiQueryService
  let refreshService: CallKpiRefreshService

  beforeAll(async () => {
    ensureTestEnv()
    token = await buildJwt({ sub: 'user-1' })

    app = await buildTestApp({
      users: [{ id: 'user-1', email: 'user@example.com', name: 'User One', isActive: true }],
      memberships: [
        { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', isActive: true },
        { userId: 'user-1', tenantId: 'tenant-2', role: 'VIEWER', isActive: true },
      ],
      tenants: [
        { id: 'tenant-1', name: 'Tenant 1', slug: 'tenant-1', backendClientId: 'client-1', isActive: true },
        { id: 'tenant-2', name: 'Tenant 2', slug: 'tenant-2', backendClientId: 'client-2', isActive: true },
      ],
      clients: [
        { id: 'client-1', name: 'Client 1', slug: 'client-1', isActive: true },
        { id: 'client-2', name: 'Client 2', slug: 'client-2', isActive: true },
      ],
    })

    queryService = app.get(CallKpiQueryService)
    refreshService = app.get(CallKpiRefreshService)

    jest.spyOn(queryService, 'getSummary').mockImplementation(async ({ clientId }) => {
      const response: CallKpiSummaryResponse =
        clientId === 'client-2'
          ? {
              period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
              received: { count: 22 },
              lost: { count: 3 },
              totalInbound: { count: 25 },
              telemarketingOpenBudgets: { count: 5 },
              peakHour: { hour: '09', totalInboundCount: 7 },
            }
          : {
              period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
              received: { count: 12 },
              lost: { count: 4 },
              totalInbound: { count: 16 },
              telemarketingOpenBudgets: { count: 3 },
              peakHour: { hour: '10', totalInboundCount: 7 },
            }

      return response
    })
    jest.spyOn(queryService, 'getHourly').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      rows: [{ hour: '08', receivedCount: 2, lostCount: 1, totalInboundCount: 3 }],
    } satisfies CallKpiHourlyResponse)
    jest.spyOn(queryService, 'getAgentRanking').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      rows: [
        {
          agentType: 'EMPLOYEE',
          agentKey: 'employee:ext-1',
          agentLabel: 'Maria',
          employeeName: 'Maria',
          extensionNumber: '104',
          receivedCount: 2,
          lostCount: 1,
          totalInboundCount: 3,
        },
      ],
    } satisfies CallKpiAgentRankingResponse)
    jest.spyOn(queryService, 'getHourlyComparison').mockResolvedValue({
      period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
      rows: [{ hour: '08', receivedCount: 2, lostCount: 1, telemarketingBudgetCount: 1 }],
    } satisfies CallKpiHourlyComparisonResponse)
    jest.spyOn(refreshService, 'refresh').mockResolvedValue({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      calculationRunId: 'run-1',
      recordsRead: 3,
      snapshotsCreated: 5,
      breakdownsCreated: 8,
      availabilityEnabled: true,
    } satisfies CallKpiRefreshResult)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('requires the auth and tenant guards', async () => {
    await request(app.getHttpServer()).get('/kpis/calls/summary').query({ from: '2026-01-01', to: '2026-01-31' }).expect(401)

    await request(app.getHttpServer())
      .get('/kpis/calls/summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(400)
  })

  it('returns the call summary for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-2')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        received: { count: 22 },
        lost: { count: 3 },
        totalInbound: { count: 25 },
        telemarketingOpenBudgets: { count: 5 },
        peakHour: { hour: '09', totalInboundCount: 7 },
      })

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-2',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('passes extensionUuid and extensionNumber through the call summary endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', extensionUuid: 'ext-1', extensionNumber: '104' })
      .expect(200)

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      extensionUuid: 'ext-1',
      extensionNumber: '104',
    })
  })

  it('passes branchId through the call summary endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', branchId: '12' })
      .expect(200)

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 12,
    })
  })

  it('returns the call hourly series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/hourly')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        rows: [{ hour: '08', receivedCount: 2, lostCount: 1, totalInboundCount: 3 }],
      })

    expect(queryService.getHourly).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('returns the call agent ranking for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/agents/ranking')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-2')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        rows: [
          {
            agentType: 'EMPLOYEE',
            agentKey: 'employee:ext-1',
            agentLabel: 'Maria',
            employeeName: 'Maria',
            extensionNumber: '104',
            receivedCount: 2,
            lostCount: 1,
            totalInboundCount: 3,
          },
        ],
      })

    expect(queryService.getAgentRanking).toHaveBeenCalledWith({
      clientId: 'client-2',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('returns the hourly comparison for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/hourly/comparison')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31' })
      .expect(200)
      .expect({
        period: { from: '2026-01-01', to: '2026-01-31', key: '2026-01-01_2026-01-31' },
        rows: [{ hour: '08', receivedCount: 2, lostCount: 1, telemarketingBudgetCount: 1 }],
      })

    expect(queryService.getHourlyComparison).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('passes branchId through the hourly comparison endpoint', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/hourly/comparison')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', branchId: '12' })
      .expect(200)

    expect(queryService.getHourlyComparison).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 12,
    })
  })

  it('refreshes the call kpis for the active tenant client', async () => {
    await request(app.getHttpServer())
      .post('/kpis/calls/refresh')
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
        snapshotsCreated: 5,
        breakdownsCreated: 8,
        availabilityEnabled: true,
      })

    expect(refreshService.refresh).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('rejects branchId on the refresh endpoint', async () => {
    await request(app.getHttpServer())
      .post('/kpis/calls/refresh')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', branchId: '12' })
      .expect(400)
  })

  it('rejects sellerId on the refresh endpoint', async () => {
    await request(app.getHttpServer())
      .post('/kpis/calls/refresh')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-01', to: '2026-01-31', sellerId: '7' })
      .expect(400)
  })

  it('rejects invalid date ranges with 400', async () => {
    await request(app.getHttpServer())
      .get('/kpis/calls/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-01-31', to: '2026-01-01' })
      .expect(400)
  })
})
