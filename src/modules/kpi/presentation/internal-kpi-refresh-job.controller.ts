import { Controller, Headers, HttpCode, Post, Query, UnauthorizedException } from '@nestjs/common'
import { InternalKpiRefreshJobService } from '../application/internal-kpi-refresh-job.service'
import { parseInternalKpiRefreshJobQuery } from './query/internal-kpi-refresh-job.query'

@Controller('internal/jobs/kpis')
export class InternalKpiRefreshJobController {
  constructor(private readonly internalKpiRefreshJobService: InternalKpiRefreshJobService) {}

  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    if (typeof jobKey !== 'string' || jobKey.trim() === '') {
      throw new UnauthorizedException('Missing X-Job-Key header')
    }

    const parsedQuery = parseInternalKpiRefreshJobQuery(query)

    return this.internalKpiRefreshJobService.run({
      jobKey,
      ...parsedQuery,
    })
  }
}
