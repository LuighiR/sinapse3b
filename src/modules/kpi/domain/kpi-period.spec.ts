import { KpiPeriod } from './kpi-period'

describe('KpiPeriod', () => {
  it('treats date-only periods as Sao Paulo calendar boundaries (UTC-3)', () => {
    const period = KpiPeriod.between({
      from: '2026-01-01',
      to: '2026-01-03',
    })

    expect(period.from).toEqual(new Date(Date.UTC(2026, 0, 1, 3, 0, 0)))
    expect(period.to).toEqual(new Date(Date.UTC(2026, 0, 3, 3, 0, 0)))
    expect(period.key).toBe('2026-01-01_2026-01-03')
  })

  it('rejects invalid calendar dates', () => {
    expect(() =>
      KpiPeriod.between({
        from: '2026-02-31',
        to: '2026-03-01',
      }),
    ).toThrow('Invalid KPI date: 2026-02-31')
  })
})
