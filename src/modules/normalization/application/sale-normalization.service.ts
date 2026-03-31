import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { mapSaleStatus, type NormalizedSaleStatus } from './sale-status.mapper'

export const RAW_FERRACO_SALE_READER = 'RAW_FERRACO_SALE_READER'
export const SALE_FACT_UPSERT_REPOSITORY = 'SALE_FACT_UPSERT_REPOSITORY'

export type RawFerracoSaleRecord = {
  id: number | string
  clientId: string
  branch: string | null
  sellerId: number | string | null
  sellerName: string | null
  saleDate: string | Date
  saleTime: string | Date | null
  canceled: string | null
  customerName: string | null
  cpfCnpj: string | null
  value: string | number | null
  sequential: string | number | bigint | null
  invoiceSerie: string | number | bigint | null
  invoiceNumeric: string | number | bigint | null
  listDavsId: string | null
  channel: string | null
  hasLinkedBudget: boolean
  linkedBudgetSourceRecordId: number | null
  payload: Record<string, unknown> | null
}

export type SaleFactWritePayload = {
  clientId: string
  sourceTable: string
  sourceRecordId: number
  branchId: number | null
  branchName: string
  sellerId: number
  sellerName: string
  saleDate: Date
  saleDatetime: Date
  statusRaw: string | null
  statusNormalized: NormalizedSaleStatus
  channel: string | null
  hasLinkedBudget: boolean
  linkedBudgetSourceRecordId: number | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string
  sequential: bigint | null
  invoiceSerie: bigint | null
  invoiceNumeric: bigint | null
  listDavsId: string | null
  payloadJson: Record<string, unknown>
}

export type SaleFactUpsertArgs = {
  where: {
    clientId_sourceTable_sourceRecordId: {
      clientId: string
      sourceTable: string
      sourceRecordId: number
    }
  }
  create: SaleFactWritePayload
  update: SaleFactWritePayload
}

export type RawFerracoSaleReader = {
  findByClientId(clientId: string): Promise<RawFerracoSaleRecord[]>
  countByClientId?(clientId: string): Promise<number>
}

export type SaleFactUpsertRepository = {
  upsert(args: SaleFactUpsertArgs): Promise<void>
  bulkUpsertClient?(clientId: string): Promise<void>
}

export type SaleNormalizationResult = {
  recordsRead: number
  recordsWritten: number
}

type PrismaSaleFactDelegate = {
  saleFact: {
    upsert(args: unknown): Promise<unknown>
  }
}

@Injectable()
export class PrismaRawFerracoSaleReader implements RawFerracoSaleReader {
  constructor(private readonly prisma: PrismaService) {}

  async countByClientId(clientId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: string | number | bigint }>>`
      SELECT count(*)::text AS count
      FROM raw.ferraco_sales AS sale
      WHERE sale.client_id = ${clientId}
    `

    return Number(rows[0]?.count ?? 0)
  }

  async findByClientId(clientId: string): Promise<RawFerracoSaleRecord[]> {
    return this.prisma.$queryRaw<RawFerracoSaleRecord[]>`
      SELECT
        sale.id,
        sale.client_id AS "clientId",
        sale.branch,
        sale.seller_id AS "sellerId",
        sale.seller_name AS "sellerName",
        sale.date AS "saleDate",
        sale.hour::text AS "saleTime",
        sale.canceled,
        sale.customer_name AS "customerName",
        sale.cpf_cnpj AS "cpfCnpj",
        sale.value::text AS "value",
        sale.sequential::text AS sequential,
        sale.invoice_serie::text AS "invoiceSerie",
        sale.invoice_numeric::text AS "invoiceNumeric",
        sale.list_davs_id AS "listDavsId",
        linked.channel,
        (linked.linked_budget_source_record_id IS NOT NULL) AS "hasLinkedBudget",
        linked.linked_budget_source_record_id AS "linkedBudgetSourceRecordId",
        row_to_json(sale) AS payload
      FROM raw.ferraco_sales AS sale
      LEFT JOIN LATERAL (
        SELECT
          budget.source_record_id AS linked_budget_source_record_id,
          budget.channel
        FROM core.budget_facts AS budget
        WHERE budget.client_id = sale.client_id
          AND budget.sequential_linked_sale = sale.sequential
        ORDER BY budget.id ASC
        LIMIT 1
      ) AS linked ON TRUE
      WHERE sale.client_id = ${clientId}
      ORDER BY sale.id ASC
    `
  }
}

@Injectable()
export class PrismaSaleFactUpsertRepository implements SaleFactUpsertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(args: SaleFactUpsertArgs): Promise<void> {
    const saleFactDelegate = (this.prisma as unknown as PrismaSaleFactDelegate).saleFact

    await saleFactDelegate.upsert(args)
  }

  async bulkUpsertClient(clientId: string): Promise<void> {
    await this.prisma.$executeRaw`
      WITH linked_budget AS (
        SELECT DISTINCT ON (budget.client_id, budget.sequential_linked_sale)
          budget.client_id,
          budget.sequential_linked_sale,
          budget.source_record_id AS linked_budget_source_record_id,
          budget.channel
        FROM core.budget_facts AS budget
        WHERE budget.client_id = ${clientId}
          AND budget.sequential_linked_sale IS NOT NULL
        ORDER BY budget.client_id, budget.sequential_linked_sale, budget.id ASC
      )
      INSERT INTO core.sale_facts (
        client_id,
        source_table,
        source_record_id,
        branch_name,
        branch_id,
        seller_id,
        seller_name,
        sale_date,
        sale_datetime,
        status_raw,
        status_normalized,
        channel,
        has_linked_budget,
        linked_budget_source_record_id,
        customer_name,
        cpf_cnpj,
        value_amount,
        sequential,
        invoice_serie,
        invoice_numeric,
        list_davs_id,
        payload_json
      )
      SELECT
        sale.client_id,
        'raw.ferraco_sales',
        sale.id,
        COALESCE(sale.branch, ''),
        NULL::integer,
        COALESCE(sale.seller_id, 0),
        COALESCE(sale.seller_name, ''),
        sale.date,
        sale.date::timestamp + COALESCE(sale.hour, time '00:00:00'),
        sale.canceled,
        CASE
          WHEN sale.canceled = 'N' THEN 'VALID'
          WHEN sale.canceled = 'S' THEN 'CANCELED'
          ELSE 'UNKNOWN'
        END,
        linked_budget.channel,
        (linked_budget.linked_budget_source_record_id IS NOT NULL),
        linked_budget.linked_budget_source_record_id,
        COALESCE(sale.customer_name, ''),
        sale.cpf_cnpj,
        COALESCE(sale.value, 0),
        sale.sequential,
        sale.invoice_serie,
        sale.invoice_numeric,
        sale.list_davs_id,
        row_to_json(sale)
      FROM raw.ferraco_sales AS sale
      LEFT JOIN linked_budget
        ON linked_budget.client_id = sale.client_id
       AND linked_budget.sequential_linked_sale = sale.sequential
      WHERE sale.client_id = ${clientId}
      ON CONFLICT (client_id, source_table, source_record_id)
      DO UPDATE SET
        branch_name = EXCLUDED.branch_name,
        branch_id = EXCLUDED.branch_id,
        seller_id = EXCLUDED.seller_id,
        seller_name = EXCLUDED.seller_name,
        sale_date = EXCLUDED.sale_date,
        sale_datetime = EXCLUDED.sale_datetime,
        status_raw = EXCLUDED.status_raw,
        status_normalized = EXCLUDED.status_normalized,
        channel = EXCLUDED.channel,
        has_linked_budget = EXCLUDED.has_linked_budget,
        linked_budget_source_record_id = EXCLUDED.linked_budget_source_record_id,
        customer_name = EXCLUDED.customer_name,
        cpf_cnpj = EXCLUDED.cpf_cnpj,
        value_amount = EXCLUDED.value_amount,
        sequential = EXCLUDED.sequential,
        invoice_serie = EXCLUDED.invoice_serie,
        invoice_numeric = EXCLUDED.invoice_numeric,
        list_davs_id = EXCLUDED.list_davs_id,
        payload_json = EXCLUDED.payload_json,
        updated_at = now()
    `
  }
}

@Injectable()
export class SaleNormalizationService {
  private readonly sourceTable = 'raw.ferraco_sales'
  private readonly upsertBatchSize = 250

  constructor(
    @Inject(RAW_FERRACO_SALE_READER)
    private readonly rawReader: RawFerracoSaleReader,
    @Inject(SALE_FACT_UPSERT_REPOSITORY)
    private readonly saleFactRepository: SaleFactUpsertRepository,
  ) {}

  async normalizeClientSales(clientId: string): Promise<SaleNormalizationResult> {
    const recordsRead = await this.countRawSales(clientId)

    if (recordsRead === 0) {
      return {
        recordsRead: 0,
        recordsWritten: 0,
      }
    }

    if (this.saleFactRepository.bulkUpsertClient) {
      await this.saleFactRepository.bulkUpsertClient(clientId)

      return {
        recordsRead,
        recordsWritten: recordsRead,
      }
    }

    const sales = await this.rawReader.findByClientId(clientId)
    const normalizedSales = sales.map((sale) => this.normalizeSale(clientId, sale))

    for (let index = 0; index < normalizedSales.length; index += this.upsertBatchSize) {
      const batch = normalizedSales.slice(index, index + this.upsertBatchSize)

      await Promise.all(
        batch.map((normalizedSale) =>
          this.saleFactRepository.upsert({
            where: {
              clientId_sourceTable_sourceRecordId: {
                clientId,
                sourceTable: this.sourceTable,
                sourceRecordId: normalizedSale.sourceRecordId,
              },
            },
            create: normalizedSale,
            update: normalizedSale,
          }),
        ),
      )
    }

    return {
      recordsRead,
      recordsWritten: normalizedSales.length,
    }
  }

  private async countRawSales(clientId: string): Promise<number> {
    if (this.rawReader.countByClientId) {
      return this.rawReader.countByClientId(clientId)
    }

    const sales = await this.rawReader.findByClientId(clientId)
    return sales.length
  }

  private normalizeSale(clientId: string, sale: RawFerracoSaleRecord): SaleFactWritePayload {
    return {
      clientId,
      sourceTable: this.sourceTable,
      sourceRecordId: this.parseNumber(sale.id, 'id'),
      branchId: null,
      branchName: sale.branch ?? '',
      sellerId: this.parseNumberOrDefault(sale.sellerId, 0),
      sellerName: sale.sellerName ?? '',
      saleDate: this.parseDateOnly(sale.saleDate),
      saleDatetime: this.parseSaleDatetime(sale.saleDate, sale.saleTime),
      statusRaw: sale.canceled,
      statusNormalized: mapSaleStatus(sale.canceled),
      channel: sale.channel,
      hasLinkedBudget: sale.hasLinkedBudget,
      linkedBudgetSourceRecordId: sale.linkedBudgetSourceRecordId,
      customerName: sale.customerName ?? '',
      cpfCnpj: sale.cpfCnpj,
      valueAmount: this.parseDecimalString(sale.value),
      sequential: this.parseOptionalBigInt(sale.sequential),
      invoiceSerie: this.parseOptionalBigInt(sale.invoiceSerie),
      invoiceNumeric: this.parseOptionalBigInt(sale.invoiceNumeric),
      listDavsId: sale.listDavsId,
      payloadJson: sale.payload ?? {},
    }
  }

  private parseDateOnly(value: string | Date): Date {
    const [year, month, day] = this.getDateParts(value)

    return new Date(year, month - 1, day)
  }

  private parseSaleDatetime(date: string | Date, time: string | Date | null): Date {
    const [year, month, day] = this.getDateParts(date)
    const [hours, minutes, seconds] = this.getTimeParts(time)

    return new Date(year, month - 1, day, hours, minutes, seconds)
  }

  private parseNumber(value: number | string | null, fieldName: string): number {
    if (value == null || value === '') {
      throw new Error(`Missing required sale field: ${fieldName}`)
    }

    const parsedValue = Number(value)

    if (!Number.isFinite(parsedValue)) {
      throw new Error(`Invalid numeric sale field: ${fieldName}`)
    }

    return parsedValue
  }

  private parseNumberOrDefault(value: number | string | null, fallback: number): number {
    if (value == null || value === '') {
      return fallback
    }

    const parsedValue = Number(value)

    if (!Number.isFinite(parsedValue)) {
      return fallback
    }

    return parsedValue
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
