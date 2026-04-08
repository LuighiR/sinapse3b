import { Controller, Get, Headers, HttpCode, Param, Post, Query, UnauthorizedException } from '@nestjs/common'
import { InternalKpiRefreshJobCreateService } from '../application/internal-kpi-refresh-job-create.service'
import { InternalKpiRefreshJobStatusService } from '../application/internal-kpi-refresh-job-status.service'
import { parseInternalKpiRefreshJobIdParam } from './query/internal-kpi-refresh-job-id.param'
import { parseInternalKpiRefreshJobQuery } from './query/internal-kpi-refresh-job.query'

@Controller('internal/jobs/kpis')
export class InternalKpiRefreshJobController {
  constructor(
    private readonly createService: InternalKpiRefreshJobCreateService,
    private readonly statusService: InternalKpiRefreshJobStatusService,
  ) {}

  @Post('refresh')
  @HttpCode(202)
  refresh(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    if (typeof jobKey !== 'string' || jobKey.trim() === '') {
      throw new UnauthorizedException('Missing X-Job-Key header')
    }

    const parsedQuery = parseInternalKpiRefreshJobQuery(query)

    return this.createService.create({
      jobKey,
      ...parsedQuery,
    })
  }

  @Get('refresh/:jobId')
  getStatus(
    @Headers('x-job-key') jobKey: string | undefined,
    @Param('jobId') jobId: string,
  ) {
    if (typeof jobKey !== 'string' || jobKey.trim() === '') {
      throw new UnauthorizedException('Missing X-Job-Key header')
    }

    return this.statusService.getStatus({
      jobKey,
      jobId: parseInternalKpiRefreshJobIdParam(jobId),
    })
  }
}
