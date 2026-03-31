import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { BudgetKpiQueryService } from '../application/budget-kpi-query.service'
import { BudgetKpiRefreshService } from '../application/budget-kpi-refresh.service'
import { parseBudgetChannelAbandonmentQuery } from './query/budget-channel-abandonment.query'
import { parseBudgetChannelDailyQuery } from './query/budget-channel-daily.query'
import { parseBudgetChannelHourlyQuery } from './query/budget-channel-hourly.query'
import { parseBudgetDailyQuery } from './query/budget-daily.query'
import { parseBudgetDrilldownQuery } from './query/budget-drilldown.query'
import { parseBudgetFollowUpDailyQuery } from './query/budget-follow-up-daily.query'
import { parseBudgetFollowUpDrilldownQuery } from './query/budget-follow-up-drilldown.query'
import { parseBudgetFollowUpSummaryQuery } from './query/budget-follow-up-summary.query'
import { parseBudgetHourlyQuery } from './query/budget-hourly.query'
import { parseBudgetSummaryQuery } from './query/budget-summary.query'

@Controller('kpis/budgets')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class KpiController {
  constructor(
    private readonly refreshService: BudgetKpiRefreshService,
    private readonly queryService: BudgetKpiQueryService,
  ) {}

  @Post('refresh')
  @HttpCode(200)
  refreshBudgetKpis(
    @RequestContext() authContext: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    const period = parseBudgetSummaryQuery(query)

    return this.refreshService.refresh({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('summary')
  getSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetSummaryQuery(query)

    return this.queryService.getSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('daily')
  getDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetDailyQuery(query)

    return this.queryService.getDailySeries({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/summary')
  getFollowUpSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpSummaryQuery(query)

    return this.queryService.getFollowUpSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/daily')
  getFollowUpDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpDailyQuery(query)

    return this.queryService.getFollowUpDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/drilldown')
  getFollowUpDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpDrilldownQuery(query)

    return this.queryService.getFollowUpDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('hourly')
  getHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetHourlyQuery(query)

    return this.queryService.getHourlySeries({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/daily')
  getChannelDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelDailyQuery(query)

    return this.queryService.getChannelDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/hourly')
  getChannelHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelHourlyQuery(query)

    return this.queryService.getChannelHourly({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/abandonment')
  getChannelAbandonment(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelAbandonmentQuery(query)

    return this.queryService.getChannelAbandonment({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('drilldown')
  getDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetDrilldownQuery(query)

    return this.queryService.getDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }
}
