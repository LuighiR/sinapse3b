import { WhatsAppKpiQueryService, type WhatsAppKpiQueryRepository } from './whatsapp-kpi-query.service'

describe('WhatsAppKpiQueryService', () => {
  const saoPauloPeriodDate = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day, 3, 0, 0))

  it('returns summary counts for conversations and received messages', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn().mockResolvedValue({
        totalConversationsCount: 12,
        receivedMessagesCount: 34,
      }),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getSummary({
      clientId: 'client-1',
      from: '2026-03-01',
      to: '2026-03-31',
      chatId: ' maria@empresa.com ',
    })

    expect(repository.getSummaryCounts).toHaveBeenCalledWith({
      clientId: 'client-1',
      chatId: 'maria@empresa.com',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 2, 1),
        to: saoPauloPeriodDate(2026, 2, 31),
      }),
    })
    expect(result).toEqual({
      period: {
        from: '2026-03-01',
        to: '2026-03-31',
        key: '2026-03-01_2026-03-31',
      },
      totalConversations: { count: 12 },
      receivedMessages: { count: 34 },
    })
  })

  it('returns ranking rows grouped by assigned user with an unassigned fallback', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn().mockResolvedValue([
        {
          employeeId: 7,
          employeeName: 'Maria da Silva',
          employeeChatId: 'maria@empresa.com',
          assignedUserName: 'Maria',
          assignedUserEmail: 'maria@empresa.com',
          sessionsCount: 5,
        },
        {
          employeeId: null,
          employeeName: null,
          employeeChatId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          sessionsCount: 3,
        },
        {
          employeeId: null,
          employeeName: null,
          employeeChatId: null,
          assignedUserName: 'Ana',
          assignedUserEmail: 'ana@empresa.com',
          sessionsCount: 5,
        },
      ]),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getAgentRanking({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-05',
    })

    expect(result).toEqual({
      period: {
        from: '2026-03-05',
        to: '2026-03-05',
        key: '2026-03-05_2026-03-05',
      },
      rows: [
        {
          agentKey: 'ana@empresa.com',
          agentLabel: 'Ana',
          employeeId: null,
          employeeName: null,
          employeeChatId: null,
          assignedUserName: 'Ana',
          assignedUserEmail: 'ana@empresa.com',
          sessionsCount: 5,
        },
        {
          agentKey: 'employee:7',
          agentLabel: 'Maria da Silva',
          employeeId: '7',
          employeeName: 'Maria da Silva',
          employeeChatId: 'maria@empresa.com',
          assignedUserName: 'Maria',
          assignedUserEmail: 'maria@empresa.com',
          sessionsCount: 5,
        },
        {
          agentKey: 'unassigned',
          agentLabel: 'Nao atribuido',
          employeeId: null,
          employeeName: null,
          employeeChatId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          sessionsCount: 3,
        },
      ],
    })
  })

  it('returns zero-filled session hourly rows', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn().mockResolvedValue([
        { hour: '08', sessionsCount: 4 },
        { hour: '14', sessionsCount: 2 },
      ]),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getSessionsHourly({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-05',
    })

    expect(result.rows).toHaveLength(24)
    expect(result.rows[0]).toEqual({ hour: '00', sessionsCount: 0 })
    expect(result.rows[8]).toEqual({ hour: '08', sessionsCount: 4 })
    expect(result.rows[14]).toEqual({ hour: '14', sessionsCount: 2 })
  })

  it('returns zero-filled message hourly rows for human received messages only', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn().mockResolvedValue([
        { hour: '09', receivedMessagesCount: 11 },
      ]),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getMessagesHourly({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-05',
    })

    expect(result.rows).toHaveLength(24)
    expect(result.rows[9]).toEqual({ hour: '09', receivedMessagesCount: 11 })
    expect(result.rows[10]).toEqual({ hour: '10', receivedMessagesCount: 0 })
  })

  it('returns zero-filled session daily rows for each day in the range', async () => {
    const repository = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn().mockResolvedValue([
        { date: '2026-03-05', sessionsCount: 4 },
        { date: '2026-03-07', sessionsCount: 2 },
      ]),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository as any)

    const result = await (service as any).getSessionsDaily({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-07',
    })

    expect(repository.getSessionsDailyRows).toHaveBeenCalledWith({
      clientId: 'client-1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 2, 5),
        to: saoPauloPeriodDate(2026, 2, 7),
      }),
    })
    expect(result).toEqual({
      period: {
        from: '2026-03-05',
        to: '2026-03-07',
        key: '2026-03-05_2026-03-07',
      },
      rows: [
        { date: '2026-03-05', sessionsCount: 4 },
        { date: '2026-03-06', sessionsCount: 0 },
        { date: '2026-03-07', sessionsCount: 2 },
      ],
    })
  })

  it('returns zero-filled received message daily rows for each day in the range', async () => {
    const repository = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn().mockResolvedValue([
        { date: '2026-03-06', receivedMessagesCount: 11 },
      ]),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository as any)

    const result = await (service as any).getMessagesDaily({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-07',
    })

    expect(repository.getMessagesDailyRows).toHaveBeenCalledWith({
      clientId: 'client-1',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 2, 5),
        to: saoPauloPeriodDate(2026, 2, 7),
      }),
    })
    expect(result).toEqual({
      period: {
        from: '2026-03-05',
        to: '2026-03-07',
        key: '2026-03-05_2026-03-07',
      },
      rows: [
        { date: '2026-03-05', receivedMessagesCount: 0 },
        { date: '2026-03-06', receivedMessagesCount: 11 },
        { date: '2026-03-07', receivedMessagesCount: 0 },
      ],
    })
  })

  it('returns tag hourly rows for the selected tag', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn().mockResolvedValue([
        { hour: '14', sessionsCount: 30 },
      ]),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getTagHourly({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-05',
      tagId: '21830',
      chatId: ' maria@empresa.com ',
    })

    expect(repository.getTagHourlyRows).toHaveBeenCalledWith({
      clientId: 'client-1',
      chatId: 'maria@empresa.com',
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 2, 5),
        to: saoPauloPeriodDate(2026, 2, 5),
      }),
      tagId: 21830n,
    })
    expect(result.rows[14]).toEqual({ hour: '14', sessionsCount: 30 })
  })

  it('returns tag versus open budget hourly comparison rows', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn(),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn().mockResolvedValue([
        { hour: '14', tagSessionsCount: 30, openBudgetsCount: 20 },
      ]),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.getTagHourlyComparison({
      clientId: 'client-1',
      from: '2026-03-05',
      to: '2026-03-05',
      tagId: '21830',
      chatId: ' maria@empresa.com ',
      sellerId: '35747',
    })

    expect(repository.getTagHourlyComparisonRows).toHaveBeenCalledWith({
      clientId: 'client-1',
      chatId: 'maria@empresa.com',
      sellerId: 35747,
      period: expect.objectContaining({
        from: saoPauloPeriodDate(2026, 2, 5),
        to: saoPauloPeriodDate(2026, 2, 5),
      }),
      tagId: 21830n,
    })
    expect(result.rows).toHaveLength(24)
    expect(result.rows[14]).toEqual({
      hour: '14',
      tagSessionsCount: 30,
      openBudgetsCount: 20,
    })
    expect(result.rows[15]).toEqual({
      hour: '15',
      tagSessionsCount: 0,
      openBudgetsCount: 0,
    })
  })

  it('returns the available tags ordered by name', async () => {
    const repository: jest.Mocked<WhatsAppKpiQueryRepository> = {
      getSummaryCounts: jest.fn(),
      getAgentRankingRows: jest.fn(),
      getSessionsHourlyRows: jest.fn(),
      getMessagesHourlyRows: jest.fn(),
      getSessionsDailyRows: jest.fn(),
      getMessagesDailyRows: jest.fn(),
      listTags: jest.fn().mockResolvedValue([
        { tagId: 21831n, tagName: 'VIP', color: '#111111' },
        { tagId: 21830n, tagName: 'CLIENTE ATIVO', color: '#020101' },
      ]),
      getTagHourlyRows: jest.fn(),
      getTagHourlyComparisonRows: jest.fn(),
    }

    const service = new WhatsAppKpiQueryService(repository)

    const result = await service.listTags({ clientId: 'client-1' })

    expect(result).toEqual({
      tags: [
        { tagId: '21830', tagName: 'CLIENTE ATIVO', color: '#020101' },
        { tagId: '21831', tagName: 'VIP', color: '#111111' },
      ],
    })
  })
})
