import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { SaleKpiQueryService } from '../application/sale-kpi-query.service'
import { SaleKpiRefreshService } from '../application/sale-kpi-refresh.service'
import { parseSaleChannelDailyQuery } from './query/sale-channel-daily.query'
import { parseSaleDailyQuery } from './query/sale-daily.query'
import { parseSaleDrilldownQuery } from './query/sale-drilldown.query'
import { parseSaleSummaryQuery } from './query/sale-summary.query'
import { parseSaleTicketAverageQuery } from './query/sale-ticket-average.query'

@Controller('kpis/sales')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class SalesKpiController {
  constructor(
    private readonly refreshService: SaleKpiRefreshService,
    private readonly queryService: SaleKpiQueryService,
  ) {}

  @Post('refresh')
  @HttpCode(200)
  refreshSaleKpis(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleSummaryQuery(query)

    return this.refreshService.refresh({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('summary')
  getSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleSummaryQuery(query)

    return this.queryService.getSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('daily')
  getDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleDailyQuery(query)

    return this.queryService.getDailySeries({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('channel/daily')
  getChannelDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleChannelDailyQuery(query)

    return this.queryService.getChannelDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('ticket-average')
  getTicketAverage(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleTicketAverageQuery(query)

    return this.queryService.getTicketAverage({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('drilldown')
  getDrilldown(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseSaleDrilldownQuery(query)

    return this.queryService.getDrilldown({
      clientId: authContext.clientId,
      ...period,
    })
  }
}
