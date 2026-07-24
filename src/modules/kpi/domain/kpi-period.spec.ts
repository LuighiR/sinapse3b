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

  describe('formatSaoPauloDateTime', () => {
    it('formats Date wall-clock components with -03:00 without shifting hours', () => {
      expect(KpiPeriod.formatSaoPauloDateTime(new Date(Date.UTC(2026, 4, 18, 15, 25, 6, 0)))).toBe(
        '2026-05-18T15:25:06.000-03:00',
      )
    })

    it('relabels ISO strings with Z to -03:00 without shifting hours', () => {
      expect(KpiPeriod.formatSaoPauloDateTime('2026-01-02T09:30:00.000Z')).toBe(
        '2026-01-02T09:30:00.000-03:00',
      )
    })

    it('keeps already-labeled Sao Paulo strings with the same clock face', () => {
      expect(KpiPeriod.formatSaoPauloDateTime('2026-01-02T09:30:00.000-03:00')).toBe(
        '2026-01-02T09:30:00.000-03:00',
      )
    })

    it('accepts postgres-style timestamps with a space separator', () => {
      expect(KpiPeriod.formatSaoPauloDateTime('2026-06-12 11:00:38.000')).toBe(
        '2026-06-12T11:00:38.000-03:00',
      )
    })
  })
})
