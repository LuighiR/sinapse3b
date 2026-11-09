import { KpiPeriod } from '../domain/kpi-period'
import { classifyBudgetForPeriod, toBudgetPeriodBounds } from './budget-period-classifier'

describe('classifyBudgetForPeriod', () => {
  const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day))
  const january = { fromKey: '2026-01-01', toKey: '2026-01-31' }

  it('builds date-key bounds from a KPI period', () => {
    expect(toBudgetPeriodBounds(KpiPeriod.between({ from: '2026-01-01', to: '2026-01-31' }))).toEqual(january)
  })

  it('counts a budget opened and won inside the period as created, won in period and resolved in period', () => {
    expect(
      classifyBudgetForPeriod(
        { budgetDate: utcDate(2026, 0, 5), statusNormalized: 'WON', closingDate: utcDate(2026, 0, 10) },
        january,
      ),
    ).toEqual({ cards: ['wonInPeriod', 'created', 'resolvedInPeriod'], closedOutsideStatus: null })
  })

  it('counts a budget opened before the period and won inside it only as won in period', () => {
    expect(
      classifyBudgetForPeriod(
        { budgetDate: utcDate(2025, 11, 20), statusNormalized: 'WON', closingDate: utcDate(2026, 0, 3) },
        january,
      ),
    ).toEqual({ cards: ['wonInPeriod'], closedOutsideStatus: null })
  })

  it('counts a budget opened inside the period and won after it as closed outside period', () => {
    expect(
      classifyBudgetForPeriod(
        { budgetDate: utcDate(2026, 0, 15), statusNormalized: 'WON', closingDate: utcDate(2026, 1, 2) },
        january,
      ),
    ).toEqual({ cards: ['created', 'closedOutsidePeriod'], closedOutsideStatus: 'won' })
  })

  it('counts a budget opened inside the period and cancelled after it as closed outside period', () => {
    expect(
      classifyBudgetForPeriod(
        { budgetDate: utcDate(2026, 0, 20), statusNormalized: 'LOST', cancellationDate: utcDate(2026, 1, 5) },
        january,
      ),
    ).toEqual({ cards: ['created', 'closedOutsidePeriod'], closedOutsideStatus: 'lost' })
  })

  it('falls back to the legacy payload cancellation date when the column is empty', () => {
    expect(
      classifyBudgetForPeriod(
        {
          budgetDate: '2026-01-26',
          statusNormalized: 'LOST',
          cancellationDate: null,
          payloadJson: { cancellation_date: '2026-01-27' },
        },
        january,
      ),
    ).toEqual({ cards: ['lostInPeriod', 'created', 'resolvedInPeriod'], closedOutsideStatus: null })
  })

  it('counts an open budget created inside the period as open', () => {
    expect(
      classifyBudgetForPeriod({ budgetDate: utcDate(2026, 0, 25), statusNormalized: 'OPEN' }, january),
    ).toEqual({ cards: ['created', 'open'], closedOutsideStatus: null })
  })

  it('marks won budgets without closing date and unknown statuses as unclassified', () => {
    expect(
      classifyBudgetForPeriod({ budgetDate: utcDate(2026, 0, 2), statusNormalized: 'WON', closingDate: null }, january),
    ).toEqual({ cards: ['created', 'unclassified'], closedOutsideStatus: null })
    expect(
      classifyBudgetForPeriod({ budgetDate: utcDate(2026, 0, 2), statusNormalized: 'UNKNOWN' }, january),
    ).toEqual({ cards: ['created', 'unclassified'], closedOutsideStatus: null })
  })

  it('ignores budgets that were neither created nor resolved inside the period', () => {
    expect(
      classifyBudgetForPeriod(
        { budgetDate: utcDate(2025, 11, 10), statusNormalized: 'WON', closingDate: utcDate(2025, 11, 15) },
        january,
      ),
    ).toEqual({ cards: [], closedOutsideStatus: null })
  })
})
