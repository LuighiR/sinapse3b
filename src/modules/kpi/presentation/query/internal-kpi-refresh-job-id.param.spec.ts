import { BadRequestException } from '@nestjs/common'
import { parseInternalKpiRefreshJobIdParam } from './internal-kpi-refresh-job-id.param'

describe('internal KPI refresh job id param parser', () => {
  it('accepts a numeric job id', () => {
    expect(parseInternalKpiRefreshJobIdParam('41')).toBe('41')
  })

  it('rejects a blank job id', () => {
    expect(() => parseInternalKpiRefreshJobIdParam('   ')).toThrow(BadRequestException)
  })

  it('rejects malformed job ids', () => {
    expect(() => parseInternalKpiRefreshJobIdParam('abc-41')).toThrow(BadRequestException)
  })
})
