import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { KpiPeriod } from '../../kpi/domain/kpi-period'

export type MessagingParityAgentRow = {
  agentEmail: string | null
  sessionsCount: number
}

export type MessagingParityMismatch = {
  kind: string
  details: string
}

export type MessagingParityCheckResult = {
  clientId: string
  from: string
  to: string
  sessionsLegacy: number
  sessionsCanonicalDkw: number
  inboundMessagesLegacy: number
  inboundMessagesCanonicalDkw: number
  agentRankingLegacy: MessagingParityAgentRow[]
  agentRankingCanonicalDkw: MessagingParityAgentRow[]
  mismatches: MessagingParityMismatch[]
}

type CountRow = {
  total_count: string | number | bigint
}

type AgentRankingRow = {
  agent_email: string | null
  sessions_count: string | number | bigint
}

@Injectable()
export class MessagingParityCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async checkClient(input: {
    clientId: string
    period: KpiPeriod
    topAgents?: number
  }): Promise<MessagingParityCheckResult> {
    const topAgents = input.topAgents ?? 5
    const periodEndExclusive = this.toExclusivePeriodEnd(input.period)

    const [
      sessionsLegacy,
      sessionsCanonicalDkw,
      inboundMessagesLegacy,
      inboundMessagesCanonicalDkw,
      agentRankingLegacy,
      agentRankingCanonicalDkw,
    ] = await Promise.all([
      this.countLegacySessions(input.clientId, input.period, periodEndExclusive),
      this.countCanonicalDkwSessions(input.clientId, input.period, periodEndExclusive),
      this.countLegacyInboundHumanMessages(input.clientId, input.period, periodEndExclusive),
      this.countCanonicalDkwInboundHumanMessages(input.clientId, input.period, periodEndExclusive),
      this.loadLegacyAgentRanking(input.clientId, input.period, periodEndExclusive, topAgents),
      this.loadCanonicalDkwAgentRanking(input.clientId, input.period, periodEndExclusive, topAgents),
    ])

    const mismatches = this.buildMismatches({
      sessionsLegacy,
      sessionsCanonicalDkw,
      inboundMessagesLegacy,
      inboundMessagesCanonicalDkw,
      agentRankingLegacy,
      agentRankingCanonicalDkw,
    })

    return {
      clientId: input.clientId,
      from: KpiPeriod.formatDateKey(input.period.from),
      to: KpiPeriod.formatDateKey(input.period.to),
      sessionsLegacy,
      sessionsCanonicalDkw,
      inboundMessagesLegacy,
      inboundMessagesCanonicalDkw,
      agentRankingLegacy,
      agentRankingCanonicalDkw,
      mismatches,
    }
  }

  private buildMismatches(input: {
    sessionsLegacy: number
    sessionsCanonicalDkw: number
    inboundMessagesLegacy: number
    inboundMessagesCanonicalDkw: number
    agentRankingLegacy: MessagingParityAgentRow[]
    agentRankingCanonicalDkw: MessagingParityAgentRow[]
  }): MessagingParityMismatch[] {
    const mismatches: MessagingParityMismatch[] = []

    if (input.sessionsLegacy !== input.sessionsCanonicalDkw) {
      mismatches.push({
        kind: 'sessions_count',
        details: `legacy=${input.sessionsLegacy}, canonical_dkw=${input.sessionsCanonicalDkw}`,
      })
    }

    if (input.inboundMessagesLegacy !== input.inboundMessagesCanonicalDkw) {
      mismatches.push({
        kind: 'inbound_human_messages_count',
        details: `legacy=${input.inboundMessagesLegacy}, canonical_dkw=${input.inboundMessagesCanonicalDkw}`,
      })
    }

    const legacyRankingKey = this.serializeAgentRanking(input.agentRankingLegacy)
    const canonicalRankingKey = this.serializeAgentRanking(input.agentRankingCanonicalDkw)

    if (legacyRankingKey !== canonicalRankingKey) {
      mismatches.push({
        kind: 'agent_ranking',
        details: `legacy=${legacyRankingKey}; canonical_dkw=${canonicalRankingKey}`,
      })
    }

    return mismatches
  }

  private serializeAgentRanking(rows: MessagingParityAgentRow[]): string {
    return rows
      .map((row) => `${row.agentEmail ?? 'null'}:${row.sessionsCount}`)
      .join('|')
  }

  private toExclusivePeriodEnd(period: KpiPeriod): Date {
    const nextDay = new Date(period.to.getTime())
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    return nextDay
  }

  private toNumber(value: string | number | bigint | null | undefined): number {
    if (value == null) {
      return 0
    }

    return Number(value)
  }

  private async countLegacySessions(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      select count(*)::bigint as total_count
      from core.sessions s
      join core.tickets t on t.id = s.ticket_id
      where t.client_id = ${clientId}
        and s.started_at >= ${period.from}
        and s.started_at < ${periodEndExclusive}
    `)

    return this.toNumber(row?.total_count)
  }

  private async countCanonicalDkwSessions(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      select count(*)::bigint as total_count
      from core.messaging_sessions ms
      where ms.client_id = ${clientId}
        and ms.provider = 'DKW'::core.messaging_provider
        and ms.started_at >= ${period.from}
        and ms.started_at < ${periodEndExclusive}
    `)

    return this.toNumber(row?.total_count)
  }

  private async countLegacyInboundHumanMessages(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      select count(*)::bigint as total_count
      from core.messages m
      join core.tickets t on t.id = m.ticket_id
      where t.client_id = ${clientId}
        and m.created_at_external >= ${period.from}
        and m.created_at_external < ${periodEndExclusive}
        and m.from_me = false
        and m.sender_type = 'HUMAN'::core.message_sender_type
    `)

    return this.toNumber(row?.total_count)
  }

  private async countCanonicalDkwInboundHumanMessages(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      select count(*)::bigint as total_count
      from core.messaging_messages mm
      where mm.client_id = ${clientId}
        and mm.provider = 'DKW'::core.messaging_provider
        and mm.created_at_external >= ${period.from}
        and mm.created_at_external < ${periodEndExclusive}
        and mm.direction = 'INBOUND'::core.messaging_direction
        and mm.sender_type = 'HUMAN'::core.messaging_sender_type
    `)

    return this.toNumber(row?.total_count)
  }

  private async loadLegacyAgentRanking(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
    topAgents: number,
  ): Promise<MessagingParityAgentRow[]> {
    const rows = await this.prisma.$queryRaw<AgentRankingRow[]>(Prisma.sql`
      select
        nullif(lower(btrim(s.assigned_user_email)), '') as agent_email,
        count(*)::bigint as sessions_count
      from core.sessions s
      join core.tickets t on t.id = s.ticket_id
      where t.client_id = ${clientId}
        and s.started_at >= ${period.from}
        and s.started_at < ${periodEndExclusive}
      group by 1
      order by sessions_count desc, agent_email asc nulls last
      limit ${topAgents}
    `)

    return rows.map((row) => ({
      agentEmail: row.agent_email,
      sessionsCount: this.toNumber(row.sessions_count),
    }))
  }

  private async loadCanonicalDkwAgentRanking(
    clientId: string,
    period: KpiPeriod,
    periodEndExclusive: Date,
    topAgents: number,
  ): Promise<MessagingParityAgentRow[]> {
    const rows = await this.prisma.$queryRaw<AgentRankingRow[]>(Prisma.sql`
      select
        nullif(lower(btrim(ms.assigned_agent_email)), '') as agent_email,
        count(*)::bigint as sessions_count
      from core.messaging_sessions ms
      where ms.client_id = ${clientId}
        and ms.provider = 'DKW'::core.messaging_provider
        and ms.started_at >= ${period.from}
        and ms.started_at < ${periodEndExclusive}
      group by 1
      order by sessions_count desc, agent_email asc nulls last
      limit ${topAgents}
    `)

    return rows.map((row) => ({
      agentEmail: row.agent_email,
      sessionsCount: this.toNumber(row.sessions_count),
    }))
  }
}
