import { KpiPeriod } from '../../kpi/domain/kpi-period'
import { splitPeriodIntoMonthlyWindows } from './dkw-migration-month-windows'

describe('splitPeriodIntoMonthlyWindows', () => {
  it('keeps a single month window when range is within the same month', () => {
    const windows = splitPeriodIntoMonthlyWindows(
      KpiPeriod.between({ from: '2024-01-15', to: '2024-01-31' }),
    )

    expect(windows).toHaveLength(1)
    expect(KpiPeriod.formatDateKey(windows[0]!.from)).toBe('2024-01-15')
    expect(KpiPeriod.formatDateKey(windows[0]!.to)).toBe('2024-01-31')
  })

  it('splits a multi-month range into calendar windows', () => {
    const windows = splitPeriodIntoMonthlyWindows(
      KpiPeriod.between({ from: '2024-01-15', to: '2024-03-10' }),
    )

    expect(windows.map((window) => window.key)).toEqual([
      '2024-01-15_2024-01-31',
      '2024-02-01_2024-02-29',
      '2024-03-01_2024-03-10',
    ])
  })
})
