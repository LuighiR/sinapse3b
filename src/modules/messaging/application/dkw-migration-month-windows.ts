import { KpiPeriod } from '../../kpi/domain/kpi-period'

export function splitPeriodIntoMonthlyWindows(period: KpiPeriod): KpiPeriod[] {
  const windows: KpiPeriod[] = []
  const endKey = KpiPeriod.formatDateKey(period.to)
  const startKey = KpiPeriod.formatDateKey(period.from)

  let year = period.from.getUTCFullYear()
  let month = period.from.getUTCMonth()

  while (true) {
    const monthStartKey =
      windows.length === 0
        ? startKey
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const monthEndKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const windowToKey = monthEndKey <= endKey ? monthEndKey : endKey

    windows.push(
      KpiPeriod.between({
        from: monthStartKey,
        to: windowToKey,
      }),
    )

    if (windowToKey === endKey) {
      break
    }

    month += 1

    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return windows
}
