import { parseSaleFactFiltersQuery } from './sale-filters.query'

describe('sale fact query parser', () => {
  it('parses branchId as an optional numeric filter', () => {
    expect(
      parseSaleFactFiltersQuery(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          branchId: '8',
        },
        'Invalid sale query params',
      ),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 8,
    })
  })
})
