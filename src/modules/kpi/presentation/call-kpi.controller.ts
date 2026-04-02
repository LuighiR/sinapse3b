import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { CallKpiQueryService } from '../application/call-kpi-query.service'
import { CallKpiRefreshService } from '../application/call-kpi-refresh.service'
import { parseCallAgentRankingQuery } from './query/call-agent-ranking.query'
import { parseCallHourlyComparisonQuery } from './query/call-hourly-comparison.query'
import { parseCallHourlyQuery } from './query/call-hourly.query'
import { parseCallRefreshQuery } from './query/call-refresh.query'
import { parseCallSummaryQuery } from './query/call-summary.query'

@Controller('kpis/calls')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class CallKpiController {
  constructor(
    private readonly refreshService: CallKpiRefreshService,
    private readonly queryService: CallKpiQueryService,
  ) {}

  @Post('refresh')
  @HttpCode(200)
  refreshCallKpis(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseCallRefreshQuery(query)

    return this.refreshService.refresh({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('summary')
  getSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseCallSummaryQuery(query)

    return this.queryService.getSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('hourly')
  getHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseCallHourlyQuery(query)

    return this.queryService.getHourly({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('agents/ranking')
  getAgentRanking(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseCallAgentRankingQuery(query)

    return this.queryService.getAgentRanking({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('hourly/comparison')
  getHourlyComparison(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseCallHourlyComparisonQuery(query)

    return this.queryService.getHourlyComparison({
      clientId: authContext.clientId,
      ...period,
    })
  }
}
