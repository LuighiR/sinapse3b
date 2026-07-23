import { BadRequestException } from '@nestjs/common'
import { parseEmployeesQuery } from './employees.query'

describe('parseEmployeesQuery', () => {
  it('parses includeInactive boolean query flags', () => {
    expect(parseEmployeesQuery({ includeInactive: 'true' })).toEqual({ includeInactive: true })
    expect(parseEmployeesQuery({ includeInactive: 'false' })).toEqual({ includeInactive: false })
  })

  it('keeps existing branchId and search parsing', () => {
    expect(parseEmployeesQuery({ branchId: '12', search: ' fabiano ' })).toEqual({
      branchId: 12,
      search: 'fabiano',
    })
  })

  it('rejects invalid includeInactive values', () => {
    expect(() => parseEmployeesQuery({ includeInactive: 'maybe' })).toThrow(BadRequestException)
  })
})
