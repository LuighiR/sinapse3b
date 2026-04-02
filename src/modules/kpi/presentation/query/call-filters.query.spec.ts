import { BadRequestException } from '@nestjs/common'
import { parseCallFactFiltersQuery } from './call-filters.query'

describe('parseCallFactFiltersQuery', () => {
  it('accepts extensionUuid and extensionNumber filters', () => {
    expect(
      parseCallFactFiltersQuery(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          extensionUuid: ' ext-1 ',
          extensionNumber: ' 104 ',
        },
        'Invalid call query params',
      ),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      extensionUuid: 'ext-1',
      extensionNumber: '104',
    })
  })

  it('accepts branchId filters', () => {
    expect(
      parseCallFactFiltersQuery(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          branchId: ' 12 ',
        },
        'Invalid call query params',
      ),
    ).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 12,
    })
  })

  it('rejects legacy sellerId filters for calls', () => {
    expect(() =>
      parseCallFactFiltersQuery(
        {
          from: '2026-01-01',
          to: '2026-01-31',
          sellerId: '7',
        },
        'Invalid call query params',
      ),
    ).toThrow(BadRequestException)
  })
})
