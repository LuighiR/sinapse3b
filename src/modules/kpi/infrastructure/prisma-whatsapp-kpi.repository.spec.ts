import { KpiPeriod } from '../domain/kpi-period'
import { PrismaWhatsAppKpiRepository } from './prisma-whatsapp-kpi.repository'

describe('PrismaWhatsAppKpiRepository', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sinapse',
      AUTH_JWT_SECRET: 'super-secret',
      AUTH_JWT_ISSUER: 'sinapse3',
      AUTH_JWT_AUDIENCE: 'sinapse3-web',
      INTERNAL_JOB_KEY: 'test-internal-job-key',
      WHATSAPP_KPI_SOURCE: 'legacy',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('reads summary counts from legacy sessions and messages by default', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          total_conversations_count: 12n,
          received_messages_count: 34n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(
      repository.getSummaryCounts({
        clientId: 'client-1',
        period: KpiPeriod.between({ from: '2026-03-01', to: '2026-03-31' }),
      }),
    ).resolves.toEqual({
      totalConversationsCount: 12n,
      receivedMessagesCount: 34n,
    })
  })

  it('adds the direct chatId filter to summary queries when provided', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          total_conversations_count: 12n,
          received_messages_count: 34n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await repository.getSummaryCounts({
      clientId: 'client-1',
      period: KpiPeriod.between({ from: '2026-03-01', to: '2026-03-31' }),
      chatId: 'maria@empresa.com',
    } as any)

    const sql = prisma.$queryRaw.mock.calls[0]?.[0]
    const sqlText = sql?.strings?.join(' ')

    expect(sql.values).toContain('maria@empresa.com')
    expect(sqlText).toContain('assigned_user_email')
    expect(sqlText).toContain('join core.sessions s on s.id = m.session_id')
    expect(sqlText).toContain('join core.tickets t on t.id = m.ticket_id')
  })

  it('reads summary counts from canonical messaging tables when configured', async () => {
    process.env.WHATSAPP_KPI_SOURCE = 'canonical'

    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          total_conversations_count: 12n,
          received_messages_count: 34n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await repository.getSummaryCounts({
      clientId: 'client-1',
      period: KpiPeriod.between({ from: '2026-03-01', to: '2026-03-31' }),
      branchId: 5,
      chatId: 'maria@empresa.com',
    } as any)

    const sql = prisma.$queryRaw.mock.calls[0]?.[0]
    const sqlText = sql?.strings?.join(' ')

    expect(sqlText).toContain('core.messaging_sessions ms')
    expect(sqlText).toContain('core.messaging_messages mm')
    expect(sqlText).toContain('assigned_agent_email')
    expect(sqlText).toContain('ms.branch_id =')
    expect(sqlText).not.toContain('core.sessions s')
  })

  it('adds the branch employee lookup to summary queries when branchId is provided', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          total_conversations_count: 12n,
          received_messages_count: 34n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await repository.getSummaryCounts({
      clientId: 'client-1',
      period: KpiPeriod.between({ from: '2026-03-01', to: '2026-03-31' }),
      branchId: 5,
    } as any)

    const sql = prisma.$queryRaw.mock.calls[0]?.[0]
    const sqlText = sql?.strings?.join(' ')

    expect(sql.values).toContain(5)
    expect(sqlText).toContain('lower(btrim(e.chat_id))')
    expect(sqlText).toContain('lower(btrim(s.assigned_user_email))')
    expect(sqlText).toContain('e.branch_id =')
    expect(sqlText).toContain('employee_count = 1')
  })

  it('reads ranking counts grouped by assigned user identity', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          employee_id: 7,
          employee_name: 'Maria da Silva',
          employee_chat_id: 'maria@empresa.com',
          assigned_user_name: 'Maria',
          assigned_user_email: 'maria@empresa.com',
          sessions_count: 5n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(
      repository.getAgentRankingRows({
        clientId: 'client-1',
        period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-05' }),
      }),
    ).resolves.toEqual([
      {
        employeeId: 7,
        employeeName: 'Maria da Silva',
        employeeChatId: 'maria@empresa.com',
        assignedUserName: 'Maria',
        assignedUserEmail: 'maria@empresa.com',
        sessionsCount: 5n,
      },
    ])
  })

  it('lists tags with a simple Prisma read scoped by client', async () => {
    const prisma = {
      tag: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21830n,
            name: 'CLIENTE ATIVO',
            color: '#020101',
          },
        ]),
      },
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(repository.listTags({ clientId: 'client-1' })).resolves.toEqual([
      {
        tagId: 21830n,
        tagName: 'CLIENTE ATIVO',
        color: '#020101',
      },
    ])
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        color: true,
      },
    })
  })

  it('reads session daily rows grouped by conversation start date', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          date: '2026-03-05',
          sessions_count: 4n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(
      repository.getSessionsDailyRows({
        clientId: 'client-1',
        period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-07' }),
      }),
    ).resolves.toEqual([
      {
        date: '2026-03-05',
        sessionsCount: 4n,
      },
    ])
  })

  it('reads received message daily rows grouped by external created date', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          date: '2026-03-06',
          received_messages_count: 11n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(
      repository.getMessagesDailyRows({
        clientId: 'client-1',
        period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-07' }),
      }),
    ).resolves.toEqual([
      {
        date: '2026-03-06',
        receivedMessagesCount: 11n,
      },
    ])
  })

  it('reads tag hourly comparison rows without linking budgets to specific sessions', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          hour: '14',
          tag_sessions_count: 30n,
          open_budgets_count: 20n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await expect(
      repository.getTagHourlyComparisonRows({
        clientId: 'client-1',
        period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-05' }),
        tagId: 21830n,
      }),
    ).resolves.toEqual([
      {
        hour: '14',
        tagSessionsCount: 30n,
        openBudgetsCount: 20n,
      },
    ])
  })

  it('adds chatId and sellerId filters to the tag comparison query when provided', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          hour: '14',
          tag_sessions_count: 30n,
          open_budgets_count: 20n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await repository.getTagHourlyComparisonRows({
      clientId: 'client-1',
      period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-05' }),
      tagId: 21830n,
      chatId: 'maria@empresa.com',
      sellerId: 35747,
    } as any)

    const sql = prisma.$queryRaw.mock.calls[0]?.[0]
    const sqlText = sql?.strings?.join(' ')

    expect(sql.values).toEqual(expect.arrayContaining(['client-1', 21830n, 'maria@empresa.com', 35747]))
    expect(sqlText).toContain('assigned_user_email')
    expect(sqlText).toContain('bf.seller_id')
  })

  it('filters both tag sessions and open budgets by branchId when requested', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          hour: '14',
          tag_sessions_count: 30n,
          open_budgets_count: 20n,
        },
      ]),
    }

    const repository = new PrismaWhatsAppKpiRepository(prisma as any)

    await repository.getTagHourlyComparisonRows({
      clientId: 'client-1',
      period: KpiPeriod.between({ from: '2026-03-05', to: '2026-03-05' }),
      tagId: 21830n,
      branchId: 5,
    } as any)

    const sql = prisma.$queryRaw.mock.calls[0]?.[0]
    const sqlText = sql?.strings?.join(' ')

    expect(sql.values).toEqual(expect.arrayContaining(['client-1', 21830n, 5]))
    expect(sqlText).toContain('lower(btrim(e.chat_id))')
    expect(sqlText).toContain('lower(btrim(s.assigned_user_email))')
    expect(sqlText).toContain('e.branch_id =')
    expect(sqlText).toContain('bf.branch_id =')
    expect(sqlText).toContain('employee_count = 1')
  })
})
