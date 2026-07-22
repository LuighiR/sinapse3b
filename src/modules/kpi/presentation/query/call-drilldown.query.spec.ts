import { BadRequestException } from '@nestjs/common'
import { parseCallDrilldownQuery } from './call-drilldown.query'

describe('parseCallDrilldownQuery', () => {
  it('parses drilldown filters with pagination defaults', () => {
    expect(
      parseCallDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        branchId: '12',
        employeeId: '7',
        status: ' answered ',
        direction: ' inbound ',
        callerNumber: ' 5551 ',
        destinationNumber: ' 1041 ',
        durationMin: '10',
        durationMax: '120',
        outcome: 'ANSWERED',
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      branchId: 12,
      employeeId: 7,
      status: 'answered',
      direction: 'inbound',
      callerNumber: '5551',
      destinationNumber: '1041',
      durationMin: 10,
      durationMax: 120,
      outcome: 'ANSWERED',
      page: 1,
      pageSize: 50,
    })
  })

  it('accepts custom pagination within bounds', () => {
    expect(
      parseCallDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        page: '2',
        pageSize: '100',
      }),
    ).toMatchObject({
      page: 2,
      pageSize: 100,
    })
  })

  it('rejects pageSize above 100', () => {
    expect(() =>
      parseCallDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        pageSize: '101',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects durationMin greater than durationMax', () => {
    expect(() =>
      parseCallDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        durationMin: '30',
        durationMax: '10',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid period ranges', () => {
    expect(() =>
      parseCallDrilldownQuery({
        from: '2026-01-31',
        to: '2026-01-01',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects legacy sellerId filters', () => {
    expect(() =>
      parseCallDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        sellerId: '7',
      }),
    ).toThrow(BadRequestException)
  })
})
