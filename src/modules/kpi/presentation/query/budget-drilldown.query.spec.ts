import { BadRequestException } from '@nestjs/common'
import { parseBudgetDrilldownQuery } from './budget-drilldown.query'

describe('parseBudgetDrilldownQuery', () => {
  it('accepts an optional status filter', () => {
    expect(
      parseBudgetDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: '7',
        status: 'Baixado',
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      sellerId: 7,
      branchId: undefined,
      branchName: undefined,
      status: 'Baixado',
    })
  })

  it('rejects invalid status values', () => {
    expect(() =>
      parseBudgetDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        status: 'Fechado',
      }),
    ).toThrow(BadRequestException)
  })
})
