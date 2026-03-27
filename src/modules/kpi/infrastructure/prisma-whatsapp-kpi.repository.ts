import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { KpiPeriod } from '../domain/kpi-period'
import {
  WhatsAppKpiAgentRankingSourceRow,
  WhatsAppKpiMessagesDailySourceRow,
  WhatsAppKpiMessagesHourlySourceRow,
  WhatsAppKpiQueryRepository,
  WhatsAppKpiSessionsDailySourceRow,
  WhatsAppKpiSessionsHourlySourceRow,
  WhatsAppKpiSummaryCountsRow,
  WhatsAppKpiTagComparisonSourceRow,
  WhatsAppKpiTagHourlySourceRow,
  WhatsAppKpiTagSourceRow,
} from '../application/whatsapp-kpi-query.service'

type SummarySqlRow = {
  total_conversations_count: string | number | bigint
  received_messages_count: string | number | bigint
}

type RankingSqlRow = {
  employee_id: string | number | bigint | null
  employee_name: string | null
  employee_chat_id: string | null
  assigned_user_name: string | null
  assigned_user_email: string | null
  sessions_count: string | number | bigint
}

type SessionsHourlySqlRow = {
  hour: string | number | bigint
  sessions_count: string | number | bigint
}

type MessagesHourlySqlRow = {
  hour: string | number | bigint
  received_messages_count: string | number | bigint
}

type SessionsDailySqlRow = {
  date: string
  sessions_count: string | number | bigint
}

type MessagesDailySqlRow = {
  date: string
  received_messages_count: string | number | bigint
}

type TagHourlySqlRow = {
  hour: string | number | bigint
  sessions_count: string | number | bigint
}

type TagComparisonSqlRow = {
  hour: string | number | bigint
  tag_sessions_count: string | number | bigint
  open_budgets_count: string | number | bigint
}

@Injectable()
export class PrismaWhatsAppKpiRepository implements WhatsAppKpiQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummaryCounts(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiSummaryCountsRow> {
    const [row] = await this.prisma.$queryRaw<SummarySqlRow[]>(Prisma.sql`
      select
        (
          select count(*)::bigint
          from core.sessions s
          join core.tickets t on t.id = s.ticket_id
          where t.client_id = ${input.clientId}
            and s.started_at >= ${input.period.from}
            and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
        ) as total_conversations_count,
        (
          select count(*)::bigint
          from core.messages m
          join core.tickets t on t.id = m.ticket_id
          where t.client_id = ${input.clientId}
            and m.created_at_external >= ${input.period.from}
            and m.created_at_external < ${this.toExclusivePeriodEnd(input.period)}
            and m.from_me = false
            and m.sender_type = 'HUMAN'::core.message_sender_type
        ) as received_messages_count
    `)

    return {
      totalConversationsCount: row?.total_conversations_count ?? 0,
      receivedMessagesCount: row?.received_messages_count ?? 0,
    }
  }

  async getAgentRankingRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiAgentRankingSourceRow[]> {
    const rows = await this.prisma.$queryRaw<RankingSqlRow[]>(Prisma.sql`
      with session_ranking as (
        select
          nullif(btrim(s.assigned_user_name), '') as assigned_user_name,
          nullif(btrim(s.assigned_user_email), '') as assigned_user_email,
          count(*)::bigint as sessions_count
        from core.sessions s
        join core.tickets t on t.id = s.ticket_id
        where t.client_id = ${input.clientId}
          and s.started_at >= ${input.period.from}
          and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
        group by 1, 2
      ),
      employee_lookup as (
        select
          lower(btrim(e.chat_id)) as employee_chat_key,
          min(e.id)::bigint as employee_id,
          case when count(*) = 1 then min(e.name) else null end as employee_name,
          case when count(*) = 1 then min(e.chat_id) else null end as employee_chat_id,
          count(*)::bigint as employee_count
        from core.employees e
        join core.branches b on b.id = e.branch_id
        where b.client_id = ${input.clientId}
          and e.chat_id is not null
          and btrim(e.chat_id) <> ''
        group by lower(btrim(e.chat_id))
      )
      select
        case when employee_lookup.employee_count = 1 then employee_lookup.employee_id else null end as employee_id,
        case when employee_lookup.employee_count = 1 then employee_lookup.employee_name else null end as employee_name,
        case when employee_lookup.employee_count = 1 then employee_lookup.employee_chat_id else null end as employee_chat_id,
        session_ranking.assigned_user_name,
        session_ranking.assigned_user_email,
        session_ranking.sessions_count
      from session_ranking
      left join employee_lookup
        on session_ranking.assigned_user_email is not null
       and employee_lookup.employee_chat_key = lower(session_ranking.assigned_user_email)
      order by
        session_ranking.sessions_count desc,
        coalesce(
          case when employee_lookup.employee_count = 1 then employee_lookup.employee_name end,
          session_ranking.assigned_user_name,
          session_ranking.assigned_user_email,
          'Nao atribuido'
        ) asc
    `)

    return rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeChatId: row.employee_chat_id,
      assignedUserName: row.assigned_user_name,
      assignedUserEmail: row.assigned_user_email,
      sessionsCount: row.sessions_count,
    }))
  }

  async getSessionsHourlyRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiSessionsHourlySourceRow[]> {
    const rows = await this.prisma.$queryRaw<SessionsHourlySqlRow[]>(Prisma.sql`
      select
        lpad(extract(hour from s.started_at)::int::text, 2, '0') as hour,
        count(*)::bigint as sessions_count
      from core.sessions s
      join core.tickets t on t.id = s.ticket_id
      where t.client_id = ${input.clientId}
        and s.started_at >= ${input.period.from}
        and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
      group by 1
      order by 1 asc
    `)

    return rows.map((row) => ({
      hour: row.hour,
      sessionsCount: row.sessions_count,
    }))
  }

  async getMessagesHourlyRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiMessagesHourlySourceRow[]> {
    const rows = await this.prisma.$queryRaw<MessagesHourlySqlRow[]>(Prisma.sql`
      select
        lpad(extract(hour from m.created_at_external)::int::text, 2, '0') as hour,
        count(*)::bigint as received_messages_count
      from core.messages m
      join core.tickets t on t.id = m.ticket_id
      where t.client_id = ${input.clientId}
        and m.created_at_external >= ${input.period.from}
        and m.created_at_external < ${this.toExclusivePeriodEnd(input.period)}
        and m.from_me = false
        and m.sender_type = 'HUMAN'::core.message_sender_type
      group by 1
      order by 1 asc
    `)

    return rows.map((row) => ({
      hour: row.hour,
      receivedMessagesCount: row.received_messages_count,
    }))
  }

  async getSessionsDailyRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiSessionsDailySourceRow[]> {
    const rows = await this.prisma.$queryRaw<SessionsDailySqlRow[]>(Prisma.sql`
      select
        to_char(
          (s.started_at - make_interval(hours => ${KpiPeriod.saoPauloUtcOffsetHours}))::date,
          'YYYY-MM-DD'
        ) as date,
        count(*)::bigint as sessions_count
      from core.sessions s
      join core.tickets t on t.id = s.ticket_id
      where t.client_id = ${input.clientId}
        and s.started_at >= ${input.period.from}
        and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
      group by 1
      order by 1 asc
    `)

    return rows.map((row) => ({
      date: row.date,
      sessionsCount: row.sessions_count,
    }))
  }

  async getMessagesDailyRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<WhatsAppKpiMessagesDailySourceRow[]> {
    const rows = await this.prisma.$queryRaw<MessagesDailySqlRow[]>(Prisma.sql`
      select
        to_char(
          (m.created_at_external - make_interval(hours => ${KpiPeriod.saoPauloUtcOffsetHours}))::date,
          'YYYY-MM-DD'
        ) as date,
        count(*)::bigint as received_messages_count
      from core.messages m
      join core.tickets t on t.id = m.ticket_id
      where t.client_id = ${input.clientId}
        and m.created_at_external >= ${input.period.from}
        and m.created_at_external < ${this.toExclusivePeriodEnd(input.period)}
        and m.from_me = false
        and m.sender_type = 'HUMAN'::core.message_sender_type
      group by 1
      order by 1 asc
    `)

    return rows.map((row) => ({
      date: row.date,
      receivedMessagesCount: row.received_messages_count,
    }))
  }

  async listTags(input: { clientId: string }): Promise<WhatsAppKpiTagSourceRow[]> {
    const prisma = this.prisma as any
    const rows = await prisma.tag.findMany({
      where: {
        clientId: input.clientId,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        color: true,
      },
    })

    return rows.map((row: { id: bigint; name: string; color: string | null }) => ({
      tagId: row.id,
      tagName: row.name,
      color: row.color,
    }))
  }

  async getTagHourlyRows(input: {
    clientId: string
    period: KpiPeriod
    tagId: bigint
  }): Promise<WhatsAppKpiTagHourlySourceRow[]> {
    const rows = await this.prisma.$queryRaw<TagHourlySqlRow[]>(Prisma.sql`
      select
        lpad(extract(hour from s.started_at)::int::text, 2, '0') as hour,
        count(*)::bigint as sessions_count
      from core.sessions s
      join core.tickets t on t.id = s.ticket_id
      join core.contact_tags ct on ct.contact_id = t.contact_id and ct.client_id = t.client_id
      where t.client_id = ${input.clientId}
        and ct.tag_id = ${input.tagId}
        and s.started_at >= ${input.period.from}
        and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
      group by 1
      order by 1 asc
    `)

    return rows.map((row) => ({
      hour: row.hour,
      sessionsCount: row.sessions_count,
    }))
  }

  async getTagHourlyComparisonRows(input: {
    clientId: string
    period: KpiPeriod
    tagId: bigint
  }): Promise<WhatsAppKpiTagComparisonSourceRow[]> {
    const rows = await this.prisma.$queryRaw<TagComparisonSqlRow[]>(Prisma.sql`
      with tag_sessions as (
        select
          lpad(extract(hour from s.started_at)::int::text, 2, '0') as hour,
          count(*)::bigint as tag_sessions_count
        from core.sessions s
        join core.tickets t on t.id = s.ticket_id
        join core.contact_tags ct on ct.contact_id = t.contact_id and ct.client_id = t.client_id
        where t.client_id = ${input.clientId}
          and ct.tag_id = ${input.tagId}
          and s.started_at >= ${input.period.from}
          and s.started_at < ${this.toExclusivePeriodEnd(input.period)}
        group by 1
      ),
      open_budgets as (
        select
          lpad(extract(hour from bf.budget_datetime)::int::text, 2, '0') as hour,
          count(*)::bigint as open_budgets_count
        from core.budget_facts bf
        where bf.client_id = ${input.clientId}
          and bf.status_normalized = 'OPEN'
          and bf.budget_datetime >= ${input.period.from}
          and bf.budget_datetime < ${this.toExclusivePeriodEnd(input.period)}
        group by 1
      )
      select
        coalesce(tag_sessions.hour, open_budgets.hour) as hour,
        coalesce(tag_sessions.tag_sessions_count, 0)::bigint as tag_sessions_count,
        coalesce(open_budgets.open_budgets_count, 0)::bigint as open_budgets_count
      from tag_sessions
      full outer join open_budgets on open_budgets.hour = tag_sessions.hour
      order by 1 asc
    `)

    return rows.map((row) => ({
      hour: row.hour,
      tagSessionsCount: row.tag_sessions_count,
      openBudgetsCount: row.open_budgets_count,
    }))
  }

  private toExclusivePeriodEnd(period: KpiPeriod): Date {
    const next = new Date(period.to.getTime())
    next.setUTCDate(next.getUTCDate() + 1)
    return next
  }
}
