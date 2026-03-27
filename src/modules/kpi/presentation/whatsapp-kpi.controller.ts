import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { WhatsAppKpiQueryService } from '../application/whatsapp-kpi-query.service'
import { parseWhatsAppAgentRankingQuery } from './query/whatsapp-agent-ranking.query'
import { parseWhatsAppMessagesDailyQuery } from './query/whatsapp-messages-daily.query'
import { parseWhatsAppMessagesHourlyQuery } from './query/whatsapp-messages-hourly.query'
import { parseWhatsAppSessionsDailyQuery } from './query/whatsapp-sessions-daily.query'
import { parseWhatsAppSessionsHourlyQuery } from './query/whatsapp-sessions-hourly.query'
import { parseWhatsAppSummaryQuery } from './query/whatsapp-summary.query'
import { parseWhatsAppTagHourlyComparisonQuery } from './query/whatsapp-tag-hourly-comparison.query'
import { parseWhatsAppTagHourlyQuery } from './query/whatsapp-tag-hourly.query'

@Controller('kpis/whatsapp')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class WhatsAppKpiController {
  constructor(private readonly queryService: WhatsAppKpiQueryService) {}

  @Get('summary')
  getSummary(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppSummaryQuery(query)

    return this.queryService.getSummary({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('agents/ranking')
  getAgentRanking(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppAgentRankingQuery(query)

    return this.queryService.getAgentRanking({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('sessions/hourly')
  getSessionsHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppSessionsHourlyQuery(query)

    return this.queryService.getSessionsHourly({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('sessions/daily')
  getSessionsDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppSessionsDailyQuery(query)

    return this.queryService.getSessionsDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('messages/hourly')
  getMessagesHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppMessagesHourlyQuery(query)

    return this.queryService.getMessagesHourly({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('messages/daily')
  getMessagesDaily(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const period = parseWhatsAppMessagesDailyQuery(query)

    return this.queryService.getMessagesDaily({
      clientId: authContext.clientId,
      ...period,
    })
  }

  @Get('tags')
  listTags(@RequestContext() authContext: AuthContext) {
    return this.queryService.listTags({
      clientId: authContext.clientId,
    })
  }

  @Get('tags/hourly')
  getTagHourly(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const input = parseWhatsAppTagHourlyQuery(query)

    return this.queryService.getTagHourly({
      clientId: authContext.clientId,
      ...input,
    })
  }

  @Get('tags/hourly/comparison')
  getTagHourlyComparison(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    const input = parseWhatsAppTagHourlyComparisonQuery(query)

    return this.queryService.getTagHourlyComparison({
      clientId: authContext.clientId,
      ...input,
    })
  }
}
