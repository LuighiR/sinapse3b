import { MessagingParityCheckService } from './messaging-parity-check.service'
import { KpiPeriod } from '../../kpi/domain/kpi-period'

describe('MessagingParityCheckService', () => {
  it('returns matching counts when legacy and canonical DKW data align', async () => {
    const period = KpiPeriod.between({ from: '2026-06-01', to: '2026-06-07' })
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ total_count: 10 }])
      .mockResolvedValueOnce([{ total_count: 10 }])
      .mockResolvedValueOnce([{ total_count: 25 }])
      .mockResolvedValueOnce([{ total_count: 25 }])
      .mockResolvedValueOnce([
        { agent_email: 'maria@empresa.com', sessions_count: 6 },
        { agent_email: 'joao@empresa.com', sessions_count: 4 },
      ])
      .mockResolvedValueOnce([
        { agent_email: 'maria@empresa.com', sessions_count: 6 },
        { agent_email: 'joao@empresa.com', sessions_count: 4 },
      ])

    const service = new MessagingParityCheckService({ $queryRaw: queryRaw } as never)

    const result = await service.checkClient({
      clientId: 'ferracosul',
      period,
      topAgents: 2,
    })

    expect(result.sessionsLegacy).toBe(10)
    expect(result.sessionsCanonicalDkw).toBe(10)
    expect(result.inboundMessagesLegacy).toBe(25)
    expect(result.inboundMessagesCanonicalDkw).toBe(25)
    expect(result.mismatches).toEqual([])
  })

  it('reports mismatches when counts or ranking diverge', async () => {
    const period = KpiPeriod.between({ from: '2026-06-01', to: '2026-06-07' })
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ total_count: 10 }])
      .mockResolvedValueOnce([{ total_count: 9 }])
      .mockResolvedValueOnce([{ total_count: 25 }])
      .mockResolvedValueOnce([{ total_count: 24 }])
      .mockResolvedValueOnce([{ agent_email: 'maria@empresa.com', sessions_count: 6 }])
      .mockResolvedValueOnce([{ agent_email: 'joao@empresa.com', sessions_count: 6 }])

    const service = new MessagingParityCheckService({ $queryRaw: queryRaw } as never)

    const result = await service.checkClient({
      clientId: 'ferracosul',
      period,
      topAgents: 1,
    })

    expect(result.mismatches.map((item) => item.kind)).toEqual([
      'sessions_count',
      'inbound_human_messages_count',
      'agent_ranking',
    ])
  })
})
