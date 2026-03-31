import { BadRequestException } from '@nestjs/common'
import { parseBudgetFollowUpDailyQuery } from './budget-follow-up-daily.query'
import { parseBudgetFollowUpDrilldownQuery } from './budget-follow-up-drilldown.query'
import { parseBudgetFollowUpSummaryQuery } from './budget-follow-up-summary.query'

function expectBadRequest(action: () => void, message: string) {
  let thrown: unknown

  try {
    action()
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(BadRequestException)

  if (thrown instanceof BadRequestException) {
    expect(thrown.message).toBe(message)
  }
}

describe('budget follow-up query parsers', () => {
  it('normalizes referenceAt without timezone as Sao Paulo time', () => {
    expect(
      parseBudgetFollowUpDailyQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: ' 2026-01-31T18:30 ',
      }),
    ).toMatchObject({
      referenceAt: '2026-01-31T18:30',
    })
  })

  it('accepts date-only referenceAt and normalizes it to the end of day in Sao Paulo', () => {
    expect(
      parseBudgetFollowUpSummaryQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        referenceAt: ' 2026-03-31 ',
      }),
    ).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      referenceAt: '2026-03-31T23:59:59.999',
      orderType: undefined,
      sellerId: undefined,
    })
  })

  it('rejects invalid referenceAt', () => {
    expectBadRequest(
      () =>
        parseBudgetFollowUpDailyQuery({
          from: '2026-01-01',
          to: '2026-01-31',
          referenceAt: 'not-a-date',
        }),
      'Invalid budget follow-up daily query params',
    )
  })

  it.each(['2026-02-31T18:30', '2026-02-31T18:30:00-03:00'])(
    'rejects invalid calendar referenceAt value %s',
    (referenceAt) => {
      expectBadRequest(
        () =>
          parseBudgetFollowUpDailyQuery({
            from: '2026-01-01',
            to: '2026-01-31',
            referenceAt,
          }),
        'Invalid budget follow-up daily query params',
      )
    },
  )

  it('preserves summary parser backward-compatible coercion and trimming', () => {
    expect(
      parseBudgetFollowUpSummaryQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: ' 2026-01-31T18:30 ',
        sellerId: '7',
        orderType: '  Balcao  ',
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30',
      sellerId: 7,
      orderType: 'Balcao',
    })
  })

  it('maps blank summary orderType to undefined', () => {
    expect(
      parseBudgetFollowUpSummaryQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: '2026-01-31T18:30',
        orderType: '   ',
      }),
    ).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30',
      orderType: undefined,
      sellerId: undefined,
    })
  })

  it('uses the summary-specific error message for invalid periods', () => {
    expectBadRequest(
      () =>
        parseBudgetFollowUpSummaryQuery({
          from: '2026-01-31',
          to: '2026-01-01',
          referenceAt: '2026-01-31T18:30',
        }),
      'Invalid budget follow-up summary query params',
    )
  })

  it('rejects invalid date on drilldown', () => {
    expectBadRequest(
      () =>
        parseBudgetFollowUpDrilldownQuery({
          from: '2026-01-01',
          to: '2026-01-31',
          referenceAt: '2026-01-31T18:30:00-03:00',
          date: '31-01-2026',
        }),
      'Invalid budget follow-up drilldown query params',
    )
  })

  it('rejects invalid followUpStatus', () => {
    expectBadRequest(
      () =>
        parseBudgetFollowUpDrilldownQuery({
          from: '2026-01-01',
          to: '2026-01-31',
          referenceAt: '2026-01-31T18:30:00-03:00',
          followUpStatus: 'closed',
        }),
      'Invalid budget follow-up drilldown query params',
    )
  })

  it('rejects invalid followUpWindow', () => {
    expectBadRequest(
      () =>
        parseBudgetFollowUpDrilldownQuery({
          from: '2026-01-01',
          to: '2026-01-31',
          referenceAt: '2026-01-31T18:30:00-03:00',
          followUpWindow: 'same-day',
        }),
      'Invalid budget follow-up drilldown query params',
    )
  })
})
