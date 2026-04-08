import { BadRequestException, Controller, Get, Headers, HttpCode, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { BudgetFollowUpDkwDispatchService } from '../application/budget-follow-up-dkw-dispatch.service'
import { BudgetKpiQueryService } from '../application/budget-kpi-query.service'
import { BudgetKpiRefreshService } from '../application/budget-kpi-refresh.service'
import { InternalKpiJobTenantResolverService } from '../application/internal-kpi-job-tenant-resolver.service'
import { BudgetFollowUpDkwDispatchAuthGuard } from './guards/budget-follow-up-dkw-dispatch-auth.guard'
import { parseBudgetChannelAbandonmentQuery } from './query/budget-channel-abandonment.query'
import { parseBudgetChannelDailyQuery } from './query/budget-channel-daily.query'
import { parseBudgetChannelHourlyQuery } from './query/budget-channel-hourly.query'
import { parseBudgetDailyQuery } from './query/budget-daily.query'
import { parseBudgetDrilldownQuery } from './query/budget-drilldown.query'
import { parseBudgetFollowUpDailyQuery } from './query/budget-follow-up-daily.query'
import { parseBudgetFollowUpDkwDispatchQuery } from './query/budget-follow-up-dkw-dispatch.query'
import { parseBudgetFollowUpDrilldownQuery } from './query/budget-follow-up-drilldown.query'
import { parseBudgetFollowUpSummaryQuery } from './query/budget-follow-up-summary.query'
import { parseBudgetHourlyQuery } from './query/budget-hourly.query'
import { parseBudgetSummaryQuery } from './query/budget-summary.query'

@Controller('kpis/budgets')
export class KpiController {
  constructor(
    private readonly refreshService: BudgetKpiRefreshService,
    private readonly queryService: BudgetKpiQueryService,
    private readonly dkwDispatchService: BudgetFollowUpDkwDispatchService,
    private readonly tenantResolver: InternalKpiJobTenantResolverService,
  ) {}

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
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
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetSummaryQuery(query)

    return this.queryService.getSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('daily')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetDailyQuery(query)

    return this.queryService.getDailySeries({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/summary')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getFollowUpSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpSummaryQuery(query)

    return this.queryService.getFollowUpSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/daily')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getFollowUpDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpDailyQuery(query)

    return this.queryService.getFollowUpDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('follow-up/drilldown')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getFollowUpDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetFollowUpDrilldownQuery(query)

    return this.queryService.getFollowUpDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Post('follow-up/dkw-dispatch')
  @HttpCode(200)
  @UseGuards(BudgetFollowUpDkwDispatchAuthGuard)
  async dispatchFollowUpDkw(
    @RequestContext() authContext: AuthContext | undefined,
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    const period = parseBudgetFollowUpDkwDispatchQuery(query)
    const clientId = await this.resolveDispatchClientId(authContext, jobKey, period.slug)

    return this.dkwDispatchService.dispatch({
      clientId,
      ...period,
    })
  }

  @Get('hourly')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetHourlyQuery(query)

    return this.queryService.getHourlySeries({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/daily')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getChannelDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelDailyQuery(query)

    return this.queryService.getChannelDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/hourly')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getChannelHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelHourlyQuery(query)

    return this.queryService.getChannelHourly({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/abandonment')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getChannelAbandonment(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetChannelAbandonmentQuery(query)

    return this.queryService.getChannelAbandonment({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('drilldown')
  @UseGuards(JwtAuthGuard, TenantScopeGuard)
  getDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseBudgetDrilldownQuery(query)

    return this.queryService.getDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }

  private async resolveDispatchClientId(
    authContext: AuthContext | undefined,
    jobKey: string | undefined,
    slug: string | undefined,
  ): Promise<string> {
    if (typeof jobKey === 'string' && jobKey.trim() !== '') {
      if (typeof slug !== 'string' || slug.trim() === '') {
        throw new BadRequestException('Slug is required when using X-Job-Key')
      }

      const tenant = await this.tenantResolver.resolveBySlug(slug)
      return tenant.clientId
    }

    if (authContext === undefined) {
      throw new UnauthorizedException('Missing authenticated user context')
    }

    return authContext.clientId
  }
}
