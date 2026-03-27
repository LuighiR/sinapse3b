import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import {
  WhatsAppKpiQueryService,
  type WhatsAppKpiMessagesDailyResponse,
  type WhatsAppKpiAgentRankingResponse,
  type WhatsAppKpiMessagesHourlyResponse,
  type WhatsAppKpiSessionsDailyResponse,
  type WhatsAppKpiSessionsHourlyResponse,
  type WhatsAppKpiSummaryResponse,
  type WhatsAppKpiTagComparisonResponse,
  type WhatsAppKpiTagHourlyResponse,
  type WhatsAppKpiTagListResponse,
} from '../src/modules/kpi/application/whatsapp-kpi-query.service'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt, ensureTestEnv } from './helpers/fakes'

describe('WhatsApp KPI endpoints', () => {
  let app: INestApplication
  let token: string
  let queryService: WhatsAppKpiQueryService

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

    queryService = app.get(WhatsAppKpiQueryService)

    jest.spyOn(queryService, 'getSummary').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      totalConversations: { count: 440 },
      receivedMessages: { count: 1880 },
    } satisfies WhatsAppKpiSummaryResponse)
    jest.spyOn(queryService, 'getAgentRanking').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      rows: [
        {
          agentKey: 'employee:7',
          agentLabel: 'Maria da Silva',
          employeeId: '7',
          employeeName: 'Maria da Silva',
          employeeChatId: 'maria@empresa.com',
          assignedUserName: 'Maria',
          assignedUserEmail: 'maria@empresa.com',
          sessionsCount: 45,
        },
      ],
    } satisfies WhatsAppKpiAgentRankingResponse)
    jest.spyOn(queryService, 'getSessionsHourly').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      rows: [{ hour: '14', sessionsCount: 30 }],
    } satisfies WhatsAppKpiSessionsHourlyResponse)
    jest.spyOn(queryService, 'getSessionsDaily').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-03', key: '2026-03-01_2026-03-03' },
      rows: [
        { date: '2026-03-01', sessionsCount: 10 },
        { date: '2026-03-02', sessionsCount: 0 },
        { date: '2026-03-03', sessionsCount: 12 },
      ],
    } satisfies WhatsAppKpiSessionsDailyResponse)
    jest.spyOn(queryService, 'getMessagesHourly').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      rows: [{ hour: '14', receivedMessagesCount: 120 }],
    } satisfies WhatsAppKpiMessagesHourlyResponse)
    jest.spyOn(queryService, 'getMessagesDaily').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-03', key: '2026-03-01_2026-03-03' },
      rows: [
        { date: '2026-03-01', receivedMessagesCount: 50 },
        { date: '2026-03-02', receivedMessagesCount: 0 },
        { date: '2026-03-03', receivedMessagesCount: 40 },
      ],
    } satisfies WhatsAppKpiMessagesDailyResponse)
    jest.spyOn(queryService, 'listTags').mockResolvedValue({
      tags: [{ tagId: '21830', tagName: 'CLIENTE ATIVO', color: '#020101' }],
    } satisfies WhatsAppKpiTagListResponse)
    jest.spyOn(queryService, 'getTagHourly').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      tagId: '21830',
      rows: [{ hour: '14', sessionsCount: 30 }],
    } satisfies WhatsAppKpiTagHourlyResponse)
    jest.spyOn(queryService, 'getTagHourlyComparison').mockResolvedValue({
      period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
      tagId: '21830',
      rows: [{ hour: '14', tagSessionsCount: 30, openBudgetsCount: 20 }],
    } satisfies WhatsAppKpiTagComparisonResponse)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('requires the auth and tenant guards', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/summary')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .expect(401)

    await request(app.getHttpServer())
      .get('/kpis/whatsapp/summary')
      .set('Authorization', `Bearer ${token}`)
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .expect(400)
  })

  it('returns the summary for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-2')
      .query({ from: '2026-03-01', to: '2026-03-31', chatId: 'maria@empresa.com' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        totalConversations: { count: 440 },
        receivedMessages: { count: 1880 },
      })

    expect(queryService.getSummary).toHaveBeenCalledWith({
      clientId: 'client-2',
      from: '2026-03-01',
      to: '2026-03-31',
      chatId: 'maria@empresa.com',
    })
  })

  it('returns the agent ranking for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/agents/ranking')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        rows: [
          {
            agentKey: 'employee:7',
            agentLabel: 'Maria da Silva',
            employeeId: '7',
            employeeName: 'Maria da Silva',
            employeeChatId: 'maria@empresa.com',
            assignedUserName: 'Maria',
            assignedUserEmail: 'maria@empresa.com',
            sessionsCount: 45,
          },
        ],
      })

    expect(queryService.getAgentRanking).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-31',
    })
  })

  it('returns the session hourly series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/sessions/hourly')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        rows: [{ hour: '14', sessionsCount: 30 }],
      })
  })

  it('returns the session daily series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/sessions/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-03' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-03', key: '2026-03-01_2026-03-03' },
        rows: [
          { date: '2026-03-01', sessionsCount: 10 },
          { date: '2026-03-02', sessionsCount: 0 },
          { date: '2026-03-03', sessionsCount: 12 },
        ],
      })

    expect(queryService.getSessionsDaily).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-03',
    })
  })

  it('returns the message hourly series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/messages/hourly')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        rows: [{ hour: '14', receivedMessagesCount: 120 }],
      })
  })

  it('returns the message daily series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/messages/daily')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-03' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-03', key: '2026-03-01_2026-03-03' },
        rows: [
          { date: '2026-03-01', receivedMessagesCount: 50 },
          { date: '2026-03-02', receivedMessagesCount: 0 },
          { date: '2026-03-03', receivedMessagesCount: 40 },
        ],
      })

    expect(queryService.getMessagesDaily).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-03',
    })
  })

  it('returns the available tags for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/tags')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .expect(200)
      .expect({
        tags: [{ tagId: '21830', tagName: 'CLIENTE ATIVO', color: '#020101' }],
      })

    expect(queryService.listTags).toHaveBeenCalledWith({
      clientId: 'client-1',
    })
  })

  it('returns the selected tag hourly series for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/tags/hourly')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-31', tagId: '21830', chatId: 'maria@empresa.com' })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        tagId: '21830',
        rows: [{ hour: '14', sessionsCount: 30 }],
      })

    expect(queryService.getTagHourly).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-31',
      tagId: '21830',
      chatId: 'maria@empresa.com',
    })
  })

  it('returns the selected tag hourly comparison for the active tenant client', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/tags/hourly/comparison')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({
        from: '2026-03-01',
        to: '2026-03-31',
        tagId: '21830',
        chatId: 'maria@empresa.com',
        sellerId: '35747',
      })
      .expect(200)
      .expect({
        period: { from: '2026-03-01', to: '2026-03-31', key: '2026-03-01_2026-03-31' },
        tagId: '21830',
        rows: [{ hour: '14', tagSessionsCount: 30, openBudgetsCount: 20 }],
      })

    expect(queryService.getTagHourlyComparison).toHaveBeenCalledWith({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-31',
      tagId: '21830',
      chatId: 'maria@empresa.com',
      sellerId: 35747,
    })
  })

  it('rejects invalid tag ids with 400', async () => {
    await request(app.getHttpServer())
      .get('/kpis/whatsapp/tags/hourly')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', 'tenant-1')
      .query({ from: '2026-03-01', to: '2026-03-31', tagId: '' })
      .expect(400)
  })
})
