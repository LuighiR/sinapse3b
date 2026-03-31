import {
  classifyBudgetFollowUpRecord,
  followUpStatus,
  followUpWindow,
  type BudgetFollowUpSourceRecord,
} from './budget-follow-up-classifier'

const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0) =>
  new Date(Date.UTC(year, month, day, hour, minute, second, millisecond))

const makeFact = (overrides: Partial<BudgetFollowUpSourceRecord> = {}): BudgetFollowUpSourceRecord =>
  ({
    budgetDatetime: utcDate(2026, 0, 10, 10, 0),
    closingDate: utcDate(2026, 0, 10),
    statusNormalized: 'WON',
    payloadJson: null,
    ...overrides,
  }) as BudgetFollowUpSourceRecord

describe('classifyBudgetFollowUpRecord', () => {
  it('uses an explicit closing_time when present', () => {
    const fact = makeFact({
      closingDate: utcDate(2026, 0, 10),
      budgetDatetime: utcDate(2026, 0, 10, 10, 0),
      statusNormalized: 'WON',
      payloadJson: { closing_time: '12:00:00' },
    })
    const explicitClosingAt = utcDate(2026, 0, 10, 15, 0, 0, 0)

    expect(classifyBudgetFollowUpRecord(fact, new Date(explicitClosingAt.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(explicitClosingAt.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('uses an explicit closingTime when present', () => {
    const fact = makeFact({
      closingDate: utcDate(2026, 0, 10),
      budgetDatetime: utcDate(2026, 0, 10, 10, 0),
      statusNormalized: 'WON',
      payloadJson: { closingTime: '12:00:00' },
    })
    const explicitClosingAt = utcDate(2026, 0, 10, 15, 0, 0, 0)

    expect(classifyBudgetFollowUpRecord(fact, new Date(explicitClosingAt.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(explicitClosingAt.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('falls back to end of Sao Paulo closing day when closing_time is missing', () => {
    const fact = makeFact({
      closingDate: utcDate(2026, 0, 10),
      budgetDatetime: utcDate(2026, 0, 10, 10, 0),
      statusNormalized: 'WON',
      payloadJson: {},
    })
    const saoPauloEndOfDay = utcDate(2026, 0, 11, 2, 59, 59, 999)

    expect(classifyBudgetFollowUpRecord(fact, new Date(saoPauloEndOfDay.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(saoPauloEndOfDay.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('falls back to end of Sao Paulo closing day when closing_time is malformed', () => {
    const fact = makeFact({
      closingDate: utcDate(2026, 0, 10),
      budgetDatetime: utcDate(2026, 0, 10, 10, 0),
      statusNormalized: 'WON',
      payloadJson: { closing_time: '25:00:00' },
    })
    const saoPauloEndOfDay = utcDate(2026, 0, 11, 2, 59, 59, 999)

    expect(classifyBudgetFollowUpRecord(fact, new Date(saoPauloEndOfDay.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(saoPauloEndOfDay.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('treats malformed closingDate strings as open instead of rolling forward', () => {
    const result = classifyBudgetFollowUpRecord(
      makeFact({
        budgetDatetime: utcDate(2026, 2, 1, 10, 0),
        closingDate: '2026-02-31',
        statusNormalized: 'WON',
        payloadJson: { closing_time: '12:00:00' },
      }),
      utcDate(2026, 2, 3, 15, 0, 0, 1),
    )

    expect(result).toEqual({
      window: followUpWindow.after24h,
      status: followUpStatus.open,
    })
  })

  it('supports valid string closingDate values', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 10, 0),
      closingDate: '2026-01-10',
      statusNormalized: 'WON',
      payloadJson: { closingTime: '12:00:00' },
    })
    const closingAt = utcDate(2026, 0, 10, 15, 0)

    expect(classifyBudgetFollowUpRecord(fact, new Date(closingAt.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(closingAt.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('uses structured cancellation data for lost rows at the boundary', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      payloadJson: {
        cancellation_date: '2026-01-09',
        cancelation_time: '23:00:00',
      },
      cancellationDate: '2026-01-10',
      cancelationTime: '12:00:00',
    })

    expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 14, 59, 59))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 15, 0, 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })
  })

  it('falls back to end of day when structured cancellation time is missing or invalid', () => {
    const missingTimeFact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      cancellationDate: '2026-01-10',
    })

    const invalidTimeFact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      cancellationDate: '2026-01-10',
      cancelationTime: '25:00:00',
    })

    const saoPauloEndOfDay = utcDate(2026, 0, 11, 2, 59, 59, 999)

    expect(classifyBudgetFollowUpRecord(missingTimeFact, new Date(saoPauloEndOfDay.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(missingTimeFact, new Date(saoPauloEndOfDay.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })

    expect(classifyBudgetFollowUpRecord(invalidTimeFact, new Date(saoPauloEndOfDay.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(invalidTimeFact, new Date(saoPauloEndOfDay.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })
  })

  it('uses legacy cancellation fields when structured fields are absent', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      payloadJson: {
        cancellation_date: '2026-01-10',
        cancelation_time: '12:00:00',
      },
    })
    const cancellationAt = utcDate(2026, 0, 10, 15, 0)

    expect(classifyBudgetFollowUpRecord(fact, new Date(cancellationAt.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(cancellationAt.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })
  })

  it('uses cancellationDate as a Date when structured data is present', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      cancellationDate: utcDate(2026, 0, 10),
      cancelationTime: '12:00:00',
      payloadJson: {
        cancellation_date: '2026-01-09',
        cancelation_time: '01:00:00',
      },
    })

    expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 14, 59, 59))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 15, 0, 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })
  })

  it('does not mix structured cancellation dates with legacy cancellation times', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      statusNormalized: 'LOST',
      cancellationDate: '2026-01-10',
      payloadJson: {
        cancelation_time: '12:00:00',
      },
    })

    const saoPauloEndOfDay = utcDate(2026, 0, 11, 2, 59, 59, 999)

    expect(classifyBudgetFollowUpRecord(fact, new Date(saoPauloEndOfDay.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.lost,
    })
  })

  it('keeps won rows on the closing path', () => {
    const fact = makeFact({
      budgetDatetime: utcDate(2026, 0, 10, 9, 0),
      closingDate: utcDate(2026, 0, 10),
      statusNormalized: 'WON',
      payloadJson: { closing_time: '12:00:00' },
    })
    const closingAt = utcDate(2026, 0, 10, 15, 0)

    expect(classifyBudgetFollowUpRecord(fact, new Date(closingAt.getTime() - 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(classifyBudgetFollowUpRecord(fact, new Date(closingAt.getTime() + 1))).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.converted,
    })
  })

  it('returns null for invalid parseable opening timestamps', () => {
    const result = classifyBudgetFollowUpRecord(
      makeFact({
        budgetDatetime: '2026-02-31T10:00:00Z',
        closingDate: utcDate(2026, 2, 1),
        statusNormalized: 'WON',
        payloadJson: { closing_time: '12:00:00' },
      }),
      utcDate(2026, 2, 3, 15, 0),
    )

    expect(result).toBeNull()
  })

  it('returns null when the budget opens after referenceAt', () => {
    const result = classifyBudgetFollowUpRecord(
      makeFact({
        budgetDatetime: utcDate(2026, 0, 11, 10, 0),
        closingDate: utcDate(2026, 0, 11),
        statusNormalized: 'WON',
        payloadJson: { closing_time: '08:00:00' },
      }),
      utcDate(2026, 0, 11, 9, 0),
    )

    expect(result).toBeNull()
  })

  it('keeps won or lost rows open when closingDate is absent', () => {
    const wonResult = classifyBudgetFollowUpRecord(
      makeFact({
        closingDate: null,
        budgetDatetime: utcDate(2026, 0, 10, 9, 0),
        statusNormalized: 'WON',
      }),
      utcDate(2026, 0, 10, 12, 0),
    )

    const lostResult = classifyBudgetFollowUpRecord(
      makeFact({
        closingDate: undefined,
        budgetDatetime: utcDate(2026, 0, 10, 9, 0),
        statusNormalized: 'LOST',
      }),
      utcDate(2026, 0, 10, 12, 0),
    )

    expect(wonResult).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
    expect(lostResult).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
  })

  it('keeps open rows open even when closingDate exists', () => {
    const result = classifyBudgetFollowUpRecord(
      makeFact({
        closingDate: utcDate(2026, 0, 10),
        budgetDatetime: utcDate(2026, 0, 10, 9, 0),
        statusNormalized: 'OPEN',
        payloadJson: { closing_time: '08:00:00' },
      }),
      utcDate(2026, 0, 10, 12, 0),
    )

    expect(result).toEqual({
      window: followUpWindow.within24h,
      status: followUpStatus.open,
    })
  })

  it.each([
    ['unknown status', { statusNormalized: 'MAYBE' }],
    ['invalid opening timestamp', { budgetDatetime: 'not-a-date' }],
  ])('returns null for %s', (_label, overrides) => {
    const result = classifyBudgetFollowUpRecord(
      makeFact({
        closingDate: utcDate(2026, 0, 10),
        payloadJson: { closing_time: '12:00:00' },
        ...overrides,
      }),
      utcDate(2026, 0, 10, 13, 0),
    )

    expect(result).toBeNull()
  })
})
