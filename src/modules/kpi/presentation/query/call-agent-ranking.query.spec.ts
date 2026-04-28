import { parseCallAgentRankingQuery } from './call-agent-ranking.query'

describe('parseCallAgentRankingQuery', () => {
  it('accepts registeredEmployeesOnly for filtering extension-only ranking rows', () => {
    expect(
      parseCallAgentRankingQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        registeredEmployeesOnly: 'true',
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      registeredEmployeesOnly: true,
    })
  })
})
