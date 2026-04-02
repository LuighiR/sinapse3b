import { parseBudgetFactFiltersQuery } from './budget-filters.query'

describe('budget fact query parser', () => {
  it('parses branchId as an optional numeric filter', () => {
    expect(
      parseBudgetFactFiltersQuery(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          branchId: '5',
        },
        'Invalid budget query params',
      ),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 5,
    })
  })
})
