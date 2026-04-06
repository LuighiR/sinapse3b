import { BadRequestException } from '@nestjs/common'
import { parseInternalKpiRefreshJobQuery } from './internal-kpi-refresh-job.query'

describe('internal KPI refresh job query parser', () => {
  it('parses slug and an inclusive Sao Paulo period', () => {
    expect(
      parseInternalKpiRefreshJobQuery({
        slug: 'ferracosul',
        from: '2026-04-01',
        to: '2026-04-06',
      }),
    ).toEqual({
      slug: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
    })
  })

  it('rejects unexpected query params', () => {
    expect(() =>
      parseInternalKpiRefreshJobQuery({
        slug: 'ferracosul',
        from: '2026-04-01',
        to: '2026-04-06',
        branchId: '5',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects periods where from is after to', () => {
    expect(() =>
      parseInternalKpiRefreshJobQuery({
        slug: 'ferracosul',
        from: '2026-04-07',
        to: '2026-04-06',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid calendar dates', () => {
    expect(() =>
      parseInternalKpiRefreshJobQuery({
        slug: 'ferracosul',
        from: '2026-02-30',
        to: '2026-04-06',
      }),
    ).toThrow(BadRequestException)
  })
})
