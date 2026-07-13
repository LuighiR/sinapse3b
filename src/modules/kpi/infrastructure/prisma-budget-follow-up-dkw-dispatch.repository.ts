import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import {
  type BudgetFollowUpDkwDispatchCandidate,
  type BudgetFollowUpDkwDispatchRepository,
} from '../application/budget-follow-up-dkw-dispatch.service'
import { KpiPeriod } from '../domain/kpi-period'

@Injectable()
export class PrismaBudgetFollowUpDkwDispatchRepository implements BudgetFollowUpDkwDispatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDispatchCandidates(input: {
    clientId: string
    period: KpiPeriod
    sellerId?: number
    branchId?: number
    orderType?: string
  }): Promise<BudgetFollowUpDkwDispatchCandidate[]> {
    const from = KpiPeriod.toDatabaseDate(input.period.from)
    const to = KpiPeriod.toDatabaseDate(input.period.to)
    const filters: Prisma.Sql[] = [
      Prisma.sql`fact.client_id = ${input.clientId}`,
      Prisma.sql`fact.source_table = 'raw.ferraco_budgets'`,
      Prisma.sql`fact.budget_date >= ${from}`,
      Prisma.sql`fact.budget_date <= ${to}`,
    ]

    if (input.sellerId !== undefined) {
      filters.push(Prisma.sql`fact.seller_id = ${input.sellerId}`)
    }

    if (input.branchId !== undefined) {
      filters.push(Prisma.sql`fact.branch_id = ${input.branchId}`)
    }

    if (input.orderType !== undefined) {
      filters.push(Prisma.sql`lower(btrim(coalesce(fact.channel, 'Nao identificado'))) = lower(btrim(${input.orderType}))`)
    }

    return this.prisma.$queryRaw<BudgetFollowUpDkwDispatchCandidate[]>(Prisma.sql`
      SELECT
        raw.id AS "rawBudgetId",
        fact.client_id AS "clientId",
        fact.source_record_id AS "sourceRecordId",
        fact.branch_id AS "branchId",
        fact.seller_id AS "sellerId",
        fact.status_normalized AS "statusNormalized",
        fact.budget_datetime AS "budgetDatetime",
        fact.closing_date AS "closingDate",
        fact.cancellation_date AS "cancellationDate",
        fact.cancelation_time AS "cancelationTime",
        fact.payload_json AS "payloadJson",
        coalesce(raw.customer_name, fact.customer_name) AS "customerName",
        raw.email AS "email",
        raw.cell_phone AS "cellPhone",
        raw.phone AS "phone",
        raw.value::text AS "valueAmount",
        raw.dav_id::text AS "davId",
        coalesce(raw.seller_name, fact.seller_name) AS "sellerName",
        (raw.opening_date::timestamp + coalesce(raw.opening_time, time '00:00:00'))::text AS "openingDatetime",
        raw.sent_dkw_at AS "sentDkwAt",
        employee.dkw_webhook AS "dkwWebhook"
      FROM core.budget_facts AS fact
      JOIN raw.ferraco_budgets AS raw
        ON raw.id = fact.source_record_id
      LEFT JOIN LATERAL (
        SELECT e.dkw_webhook
        FROM core.employees AS e
        JOIN core.branches AS b ON b.id = e.branch_id
        WHERE e.erp_id = fact.seller_id
          AND b.client_id = fact.client_id
        ORDER BY e.id ASC
        LIMIT 1
      ) AS employee
        ON TRUE
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY fact.budget_datetime DESC, fact.id DESC
    `)
  }

  async markAsSent(input: { rawBudgetId: number; sentAt: Date }): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE raw.ferraco_budgets
      SET sent_dkw_at = ${input.sentAt}
      WHERE id = ${input.rawBudgetId}
    `
  }
}
