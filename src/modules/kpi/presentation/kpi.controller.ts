import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { BudgetKpiQueryService } from '../application/budget-kpi-query.service'
import { BudgetKpiRefreshService } from '../application/budget-kpi-refresh.service'
import { parseBudgetDailyQuery } from './query/budget-daily.query'
import { parseBudgetDrilldownQuery } from './query/budget-drilldown.query'
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

  @Get('drilldown')
  getDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetDrilldownQuery(query)

    return this.queryService.getDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }
}
