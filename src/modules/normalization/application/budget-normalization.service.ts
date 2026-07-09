import { Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { EMPLOYEE_BRANCH_LOOKUP_READER, type EmployeeBranchLookupReader } from './employee-branch-lookup.service'
import { mapBudgetStatus, type NormalizedBudgetStatus } from './budget-status.mapper'

export const RAW_FERRACO_BUDGET_READER = 'RAW_FERRACO_BUDGET_READER'
export const BUDGET_FACT_UPSERT_REPOSITORY = 'BUDGET_FACT_UPSERT_REPOSITORY'

export type RawFerracoBudgetRecord = {
  id: number | string
  clientId: string
  branch: string | null
  sellerId: number | string | null
  sellerName: string | null
  openingDate: string | Date
  openingTime: string | Date | null
  cancellationDate: string | Date | null
  cancelationTime: string | Date | null
  closingDate: string | Date | null
  closingTime: string | Date | null
  status: string | null
  channel: string | null
  customerName: string | null
  cpfCnpj: string | null
  value: string | number | null
  sequential: string | number | bigint | null
  davId: string | number | bigint | null
  sequentialLinkedSale: string | number | bigint | null
  payload: Record<string, unknown> | null
}

export type BudgetFactWritePayload = {
  clientId: string
  sourceTable: string
  sourceRecordId: number
  branchId: number | null
  branchName: string
  sellerId: number
  sellerName: string
  budgetDate: Date
  budgetDatetime: Date
  cancellationDate: Date | null
  cancelationTime: string | null
  closingDate: Date | null
  statusRaw: string | null
  statusNormalized: NormalizedBudgetStatus
  channel: string | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string
  sequential: bigint | null
  davId: bigint
  sequentialLinkedSale: bigint | null
  payloadJson: Record<string, unknown>
}

export type BudgetFactUpsertArgs = {
  where: {
    clientId_sourceTable_sourceRecordId: {
      clientId: string
      sourceTable: string
      sourceRecordId: number
    }
  }
  create: BudgetFactWritePayload
  update: BudgetFactWritePayload
}

export type RawFerracoBudgetReader = {
  findByClientId(clientId: string): Promise<RawFerracoBudgetRecord[]>
  countByClientId?(clientId: string): Promise<number>
}

export type BudgetFactUpsertRepository = {
  upsert(args: BudgetFactUpsertArgs): Promise<void>
  bulkUpsertClient?(clientId: string): Promise<void>
}

export type BudgetNormalizationResult = {
  recordsRead: number
  recordsWritten: number
}

type PrismaBudgetFactDelegate = {
  budgetFact: {
    upsert(args: unknown): Promise<unknown>
  }
}

@Injectable()
export class PrismaRawFerracoBudgetReader implements RawFerracoBudgetReader {
  constructor(private readonly prisma: PrismaService) {}

  async countByClientId(clientId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: string | number | bigint }>>`
      SELECT count(*)::text AS count
      FROM raw.ferraco_budgets AS budget
      WHERE budget.client_id = ${clientId}
    `

    return Number(rows[0]?.count ?? 0)
  }

  async findByClientId(clientId: string): Promise<RawFerracoBudgetRecord[]> {
    return this.prisma.$queryRaw<RawFerracoBudgetRecord[]>`
      SELECT
        budget.id,
        budget.client_id AS "clientId",
        budget.branch,
        budget.seller_id AS "sellerId",
        budget.seller_name AS "sellerName",
        budget.opening_date AS "openingDate",
        budget.opening_time::text AS "openingTime",
        budget.cancellation_date AS "cancellationDate",
        budget.cancellation_time::text AS "cancelationTime",
        budget.closing_date AS "closingDate",
        budget.closing_time::text AS "closingTime",
        budget.status,
        budget.order_type AS channel,
        budget.customer_name AS "customerName",
        budget.cpf_cnpj AS "cpfCnpj",
        budget.value::text AS "value",
        budget.sequential::text AS "sequential",
        budget.dav_id::text AS "davId",
        budget.sequential_linked_sale::text AS "sequentialLinkedSale",
        row_to_json(budget) AS "payload"
      FROM raw.ferraco_budgets AS budget
      WHERE budget.client_id = ${clientId}
      ORDER BY budget.id ASC
    `
  }
}

@Injectable()
export class PrismaBudgetFactUpsertRepository implements BudgetFactUpsertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(args: BudgetFactUpsertArgs): Promise<void> {
    const budgetFactDelegate = (this.prisma as unknown as PrismaBudgetFactDelegate).budgetFact

    await budgetFactDelegate.upsert(args)
  }

  async bulkUpsertClient(clientId: string): Promise<void> {
    await this.prisma.$executeRaw`
      WITH employee_branch_lookup AS (
        SELECT
          eu.erp_id AS seller_id,
          eu.branch_id AS branch_id,
          b.name AS branch_name
        FROM core.employee_erp_users AS eu
        JOIN core.branches AS b ON b.id = eu.branch_id
        WHERE eu.client_id = ${clientId}
      )
      INSERT INTO core.budget_facts (
        client_id,
        source_table,
        source_record_id,
        branch_name,
        branch_id,
        seller_id,
        seller_name,
        budget_date,
        budget_datetime,
        cancellation_date,
        cancelation_time,
        closing_date,
        status_raw,
        status_normalized,
        channel,
        customer_name,
        cpf_cnpj,
        value_amount,
        sequential,
        dav_id,
        sequential_linked_sale,
        payload_json
      )
      SELECT
        budget.client_id,
        'raw.ferraco_budgets',
        budget.id,
        COALESCE(employee_branch.branch_name, COALESCE(budget.branch, '')),
        employee_branch.branch_id,
        budget.seller_id,
        COALESCE(budget.seller_name, ''),
        budget.opening_date,
        budget.opening_date::timestamp + COALESCE(budget.opening_time, time '00:00:00'),
        budget.cancellation_date,
        budget.cancellation_time,
        budget.closing_date,
        budget.status,
        CASE
          WHEN budget.status = 'Baixado' THEN 'WON'
          WHEN budget.status = 'Fechado' THEN 'WON'
          WHEN budget.status = 'Pendente' THEN 'OPEN'
          WHEN budget.status = 'Cancelado' THEN 'LOST'
          ELSE 'UNKNOWN'
        END,
        budget.order_type,
        COALESCE(budget.customer_name, ''),
        budget.cpf_cnpj,
        budget.value,
        budget.sequential,
        budget.dav_id,
        budget.sequential_linked_sale,
        row_to_json(budget)
      FROM raw.ferraco_budgets AS budget
      LEFT JOIN employee_branch_lookup AS employee_branch
        ON employee_branch.seller_id = budget.seller_id
      WHERE budget.client_id = ${clientId}
      ON CONFLICT (client_id, source_table, source_record_id)
      DO UPDATE SET
        branch_name = EXCLUDED.branch_name,
        branch_id = EXCLUDED.branch_id,
        seller_id = EXCLUDED.seller_id,
        seller_name = EXCLUDED.seller_name,
        budget_date = EXCLUDED.budget_date,
        budget_datetime = EXCLUDED.budget_datetime,
        cancellation_date = EXCLUDED.cancellation_date,
        cancelation_time = EXCLUDED.cancelation_time,
        closing_date = EXCLUDED.closing_date,
        status_raw = EXCLUDED.status_raw,
        status_normalized = EXCLUDED.status_normalized,
        channel = EXCLUDED.channel,
        customer_name = EXCLUDED.customer_name,
        cpf_cnpj = EXCLUDED.cpf_cnpj,
        value_amount = EXCLUDED.value_amount,
        sequential = EXCLUDED.sequential,
        dav_id = EXCLUDED.dav_id,
        sequential_linked_sale = EXCLUDED.sequential_linked_sale,
        payload_json = EXCLUDED.payload_json,
        updated_at = now()
    `
  }
}

@Injectable()
export class BudgetNormalizationService {
  private readonly sourceTable = 'raw.ferraco_budgets'
  private readonly upsertBatchSize = 250

  constructor(
    @Inject(RAW_FERRACO_BUDGET_READER)
    private readonly rawReader: RawFerracoBudgetReader,
    @Inject(BUDGET_FACT_UPSERT_REPOSITORY)
    private readonly budgetFactRepository: BudgetFactUpsertRepository,
    @Optional()
    @Inject(EMPLOYEE_BRANCH_LOOKUP_READER)
    private readonly employeeBranchLookupReader?: EmployeeBranchLookupReader,
  ) {}

  async normalizeClientBudgets(clientId: string): Promise<BudgetNormalizationResult> {
    const recordsRead = await this.countRawBudgets(clientId)

    if (recordsRead === 0) {
      return {
        recordsRead: 0,
        recordsWritten: 0,
      }
    }

    if (this.budgetFactRepository.bulkUpsertClient) {
      await this.budgetFactRepository.bulkUpsertClient(clientId)

      return {
        recordsRead,
        recordsWritten: recordsRead,
      }
    }

    const budgets = await this.rawReader.findByClientId(clientId)
    const employeeBranchLookup = await this.buildEmployeeBranchLookup(clientId)
    const normalizedBudgets = budgets.map((budget) => this.normalizeBudget(clientId, budget, employeeBranchLookup))

    for (let index = 0; index < normalizedBudgets.length; index += this.upsertBatchSize) {
      const batch = normalizedBudgets.slice(index, index + this.upsertBatchSize)

      await Promise.all(
        batch.map((normalizedBudget) =>
          this.budgetFactRepository.upsert({
            where: {
              clientId_sourceTable_sourceRecordId: {
                clientId,
                sourceTable: this.sourceTable,
                sourceRecordId: normalizedBudget.sourceRecordId,
              },
            },
            create: normalizedBudget,
            update: normalizedBudget,
          }),
        ),
      )
    }

    return {
      recordsRead,
      recordsWritten: normalizedBudgets.length,
    }
  }

  private async countRawBudgets(clientId: string): Promise<number> {
    if (this.rawReader.countByClientId) {
      return this.rawReader.countByClientId(clientId)
    }

    const budgets = await this.rawReader.findByClientId(clientId)
    return budgets.length
  }

  private async buildEmployeeBranchLookup(
    clientId: string,
  ): Promise<Map<number, { branchId: number | null; branchName: string | null }>> {
    if (this.employeeBranchLookupReader === undefined) {
      return new Map()
    }

    const rows = await this.employeeBranchLookupReader.findByClientId(clientId)

    return new Map(
      rows
        .filter((row) => Number.isFinite(row.sellerId))
        .map((row) => [
          row.sellerId,
          {
            branchId: row.branchId,
            branchName: row.branchName,
          },
        ]),
    )
  }

  private normalizeBudget(
    clientId: string,
    budget: RawFerracoBudgetRecord,
    employeeBranchLookup: Map<number, { branchId: number | null; branchName: string | null }>,
  ): BudgetFactWritePayload {
    const sellerId = this.parseNumber(budget.sellerId, 'sellerId')
    const branchMatch = employeeBranchLookup.get(sellerId)

    return {
      clientId,
      sourceTable: this.sourceTable,
      sourceRecordId: this.parseNumber(budget.id, 'id'),
      branchId: branchMatch?.branchId ?? null,
      branchName: branchMatch?.branchName ?? budget.branch ?? '',
      sellerId,
      sellerName: budget.sellerName ?? '',
      budgetDate: this.parseDateOnly(budget.openingDate),
      budgetDatetime: this.parseBudgetDatetime(budget.openingDate, budget.openingTime),
      cancellationDate: this.parseOptionalDateOnly(budget.cancellationDate),
      cancelationTime: this.normalizeOptionalText(budget.cancelationTime),
      closingDate: this.parseOptionalDateOnly(budget.closingDate),
      statusRaw: budget.status,
      statusNormalized: mapBudgetStatus(budget.status),
      channel: budget.channel,
      customerName: budget.customerName ?? '',
      cpfCnpj: budget.cpfCnpj,
      valueAmount: this.parseDecimalString(budget.value),
      sequential: this.parseOptionalBigInt(budget.sequential),
      davId: this.parseBigInt(budget.davId, 'davId'),
      sequentialLinkedSale: this.parseOptionalBigInt(budget.sequentialLinkedSale),
      payloadJson: {
        ...(budget.payload ?? {}),
        ...(budget.cancelationTime != null && budget.cancelationTime !== '' ? { cancelation_time: String(budget.cancelationTime) } : {}),
        ...(budget.closingTime != null && budget.closingTime !== '' ? { closing_time: String(budget.closingTime) } : {}),
      },
    }
  }

  private parseDateOnly(value: string | Date): Date {
    const [year, month, day] = this.getDateParts(value)

    return new Date(year, month - 1, day)
  }

  private parseOptionalDateOnly(value: string | Date | null): Date | null {
    if (value == null) {
      return null
    }

    return this.parseDateOnly(value)
  }

  private parseBudgetDatetime(date: string | Date, time: string | Date | null): Date {
    const [year, month, day] = this.getDateParts(date)
    const [hours, minutes, seconds] = this.getTimeParts(time)

    return new Date(year, month - 1, day, hours, minutes, seconds)
  }

  private parseNumber(value: number | string | null, fieldName: string): number {
    if (value == null || value === '') {
      throw new Error(`Missing required budget field: ${fieldName}`)
    }

    const parsedValue = Number(value)

    if (!Number.isFinite(parsedValue)) {
      throw new Error(`Invalid numeric budget field: ${fieldName}`)
    }

    return parsedValue
  }

  private parseBigInt(value: string | number | bigint | null, fieldName: string): bigint {
    if (value == null || value === '') {
      throw new Error(`Missing required budget field: ${fieldName}`)
    }

    return BigInt(value)
  }

  private parseOptionalBigInt(value: string | number | bigint | null): bigint | null {
    if (value == null || value === '') {
      return null
    }

    return BigInt(value)
  }

  private parseDecimalString(value: string | number | null): string {
    if (value == null || value === '') {
      return '0'
    }

    return String(value)
  }

  private normalizeOptionalText(value: string | Date | null): string | null {
    if (value == null) {
      return null
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    const normalizedValue = String(value).trim()

    return normalizedValue === '' ? null : normalizedValue
  }

  private getDateParts(value: string | Date): [number, number, number] {
    if (value instanceof Date) {
      return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()]
    }

    const [year, month, day] = value.split('-').map((part) => Number(part))

    return [year, month, day]
  }

  private getTimeParts(value: string | Date | null): [number, number, number] {
    if (value == null) {
      return [0, 0, 0]
    }

    if (value instanceof Date) {
      return [value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds()]
    }

    const normalizedValue = String(value).trim()

    if (normalizedValue === '') {
      return [0, 0, 0]
    }

    const [hours, minutes, seconds] = normalizedValue.split(':').map((part) => Number(part))

    return [hours, minutes, seconds]
  }
}
