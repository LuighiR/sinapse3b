import { BadRequestException } from '@nestjs/common'
import { parseSaleDrilldownQuery } from './sale-drilldown.query'

describe('parseSaleDrilldownQuery', () => {
  it('accepts the optional sales drilldown filters', () => {
    expect(
      parseSaleDrilldownQuery({
        from: '2026-01-05',
        to: '2026-01-05',
        sellerId: '7',
        status: 'Cancelada',
        orderType: 'Televendas',
        hasLinkedBudget: 'true',
      }),
    ).toMatchObject({
      from: '2026-01-05',
      to: '2026-01-05',
      sellerId: 7,
      status: 'Cancelada',
      orderType: 'Televendas',
      hasLinkedBudget: true,
    })
  })

  it('accepts hasLinkedBudget=false', () => {
    expect(
      parseSaleDrilldownQuery({
        from: '2026-01-05',
        to: '2026-01-05',
        hasLinkedBudget: 'false',
      }),
    ).toMatchObject({
      from: '2026-01-05',
      to: '2026-01-05',
      hasLinkedBudget: false,
    })
  })

  it('rejects invalid drilldown status values', () => {
    expect(() =>
      parseSaleDrilldownQuery({
        from: '2026-01-05',
        to: '2026-01-05',
        status: 'Fechada',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid hasLinkedBudget values', () => {
    expect(() =>
      parseSaleDrilldownQuery({
        from: '2026-01-05',
        to: '2026-01-05',
        hasLinkedBudget: 'talvez',
      }),
    ).toThrow(BadRequestException)
  })
})
