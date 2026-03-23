import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { KpiPeriod } from '../domain/kpi-period'
import {
  BudgetFactRecord,
  BudgetKpiBreakdownRow,
  BudgetKpiSnapshotRow,
} from './budget-kpi-refresh.service'

export type BudgetKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  sellerId?: string | number | bigint
}

export type BudgetKpiPeriodView = {
  from: string
  to: string
  key: string
}

export type BudgetKpiSummaryCard = {
  count: number
  value: string
}

export type BudgetKpiSummaryResponse = {
  period: BudgetKpiPeriodView
  total: BudgetKpiSummaryCard
  open: BudgetKpiSummaryCard
  won: BudgetKpiSummaryCard
  lost: BudgetKpiSummaryCard
}

export type BudgetKpiDailySeriesItem = {
  date: string
  count: number
  value: string
}

export type BudgetKpiDailySeriesResponse = {
  period: BudgetKpiPeriodView
  series: BudgetKpiDailySeriesItem[]
}

export type BudgetKpiDrilldownInput = BudgetKpiQueryPeriodInput & {
  branchId?: string | number | bigint
  branchName?: string
}

export type BudgetKpiDrilldownFilters = {
  sellerId?: number
  branchId?: number
  branchName?: string
}

export type BudgetKpiDrilldownFactRow = {
  id: bigint | number | string
  clientId: string
  sourceTable: string
  sourceRecordId: number | string | bigint
  branchName: string
  branchId: number | null
  sellerId: number | string | bigint
  sellerName: string
  budgetDate: Date | string
  budgetDatetime: Date | string
  closingDate: Date | string | null
  statusNormalized: string
  channel: string | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string | number | bigint
  sequential: number | string | bigint | null
  davId: number | string | bigint
  sequentialLinkedSale: number | string | bigint | null
  payloadJson: Record<string, unknown> | null
}

export type BudgetKpiDrilldownRow = {
  id: string
  sourceTable: string
  sourceRecordId: number
  budgetDate: string
  budgetDatetime: string
  closingDate: string | null
  branchId: number | null
  branchName: string
  sellerId: number
  sellerName: string
  statusNormalized: string
  channel: string | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string
  sequential: string | null
  davId: string
  sequentialLinkedSale: string | null
  payloadJson: Record<string, unknown> | null
}

export type BudgetKpiDrilldownResponse = {
  period: BudgetKpiPeriodView
  filters: BudgetKpiDrilldownFilters
  rows: BudgetKpiDrilldownRow[]
}

export type BudgetKpiQueryRepository = {
  getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiSnapshotRow[]>
  getDailyRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiBreakdownRow[]>
  getBudgetFactRows(input: {
    clientId: string
    period: KpiPeriod
    sellerId: number
  }): Promise<BudgetFactRecord[]>
  getDrilldownRows(input: {
    clientId: string
    period: KpiPeriod
    sellerId?: number
    branchId?: number
    branchName?: string
  }): Promise<BudgetKpiDrilldownFactRow[]>
}

type SummaryBucket = 'total' | 'open' | 'won' | 'lost'

@Injectable()
export class BudgetKpiQueryService {
  constructor(private readonly repository: BudgetKpiQueryRepository) {}

  async getSummary(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiSummaryResponse> {
    const period = this.toPeriod(input)
    const sellerId = this.normalizeSellerId(input.sellerId)

    if (sellerId !== undefined) {
      const facts = await this.repository.getBudgetFactRows({
        clientId: input.clientId,
        period,
        sellerId,
      })

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(facts),
      }
    }

    const rows = await this.repository.getSummaryRows({
      clientId: input.clientId,
      period,
    })

    const summary = this.createEmptySummary()

    for (const row of rows) {
      const [bucket, metric] = row.metricKey.split('.', 2)

      if (!this.isSummaryBucket(bucket) || (metric !== 'count' && metric !== 'value')) {
        continue
      }

      if (metric === 'count') {
        summary[bucket].count = this.toCount(row.metricValue)
        continue
      }

      summary[bucket].value = this.toText(row.metricValue)
    }

    return {
      period: this.toPeriodView(period),
      total: summary.total,
      open: summary.open,
      won: summary.won,
      lost: summary.lost,
    }
  }

  async getDailySeries(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiDailySeriesResponse> {
    const period = this.toPeriod(input)
    const sellerId = this.normalizeSellerId(input.sellerId)

    if (sellerId !== undefined) {
      const facts = await this.repository.getBudgetFactRows({
        clientId: input.clientId,
        period,
        sellerId,
      })

      return {
        period: this.toPeriodView(period),
        series: this.buildDailySeriesFromFacts(period, facts),
      }
    }

    const rows = await this.repository.getDailyRows({
      clientId: input.clientId,
      period,
    })

    const seriesByDate = new Map<string, BudgetKpiDailySeriesItem>()

    for (const day of period.eachDay()) {
      const date = this.toDateKey(day)
      seriesByDate.set(date, {
        date,
        count: 0,
        value: '0.0000',
      })
    }

    for (const row of rows) {
      const date = this.toDateKey(row.bucketDate)
      const current = seriesByDate.get(date) ?? {
        date,
        count: 0,
        value: '0.0000',
      }

      if (row.metricKey === 'count') {
        current.count = this.toCount(row.metricValue)
      } else if (row.metricKey === 'value') {
        current.value = this.toText(row.metricValue)
      }

      seriesByDate.set(date, current)
    }

    return {
      period: this.toPeriodView(period),
      series: this.zeroFilledSeries(period, seriesByDate),
    }
  }

  async getDrilldown(input: BudgetKpiDrilldownInput): Promise<BudgetKpiDrilldownResponse> {
    const period = this.toPeriod(input)
    const sellerId = this.normalizeSellerId(input.sellerId)
    const branchId = this.normalizeBranchId(input.branchId)
    const rows = await this.repository.getDrilldownRows({
      clientId: input.clientId,
      period,
      sellerId,
      branchId,
      branchName: input.branchName,
    })

    return {
      period: this.toPeriodView(period),
      filters: this.buildFilters({ ...input, sellerId, branchId }),
      rows: rows.map((row) => this.toDrilldownRow(row)),
    }
  }

  private createEmptySummary(): Record<SummaryBucket, BudgetKpiSummaryCard> {
    return {
      total: this.createEmptyCard(),
      open: this.createEmptyCard(),
      won: this.createEmptyCard(),
      lost: this.createEmptyCard(),
    }
  }

  private createEmptyCard(): BudgetKpiSummaryCard {
    return {
      count: 0,
      value: '0.0000',
    }
  }

  private buildSummaryFromFacts(facts: BudgetFactRecord[]): Record<SummaryBucket, BudgetKpiSummaryCard> {
    const openFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'OPEN')
    const wonFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'WON')
    const lostFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'LOST')

    return {
      total: {
        count: facts.length,
        value: this.sumValues(facts),
      },
      open: {
        count: openFacts.length,
        value: this.sumValues(openFacts),
      },
      won: {
        count: wonFacts.length,
        value: this.sumValues(wonFacts),
      },
      lost: {
        count: lostFacts.length,
        value: this.sumValues(lostFacts),
      },
    }
  }

  private buildDailySeriesFromFacts(period: KpiPeriod, facts: BudgetFactRecord[]): BudgetKpiDailySeriesItem[] {
    const seriesByDate = new Map<string, BudgetKpiDailySeriesItem>()

    for (const day of period.eachDay()) {
      const date = this.toDateKey(day)
      seriesByDate.set(date, {
        date,
        count: 0,
        value: '0.0000',
      })
    }

    for (const fact of facts) {
      const date = this.toDateKey(fact.budgetDate)
      const current = seriesByDate.get(date) ?? {
        date,
        count: 0,
        value: '0.0000',
      }

      current.count += 1
      current.value = new Prisma.Decimal(current.value)
        .add(new Prisma.Decimal(this.toText(fact.valueAmount)))
        .toFixed(4)
      seriesByDate.set(date, current)
    }

    return this.zeroFilledSeries(period, seriesByDate)
  }

  private zeroFilledSeries(
    period: KpiPeriod,
    seriesByDate: Map<string, BudgetKpiDailySeriesItem>,
  ): BudgetKpiDailySeriesItem[] {
    return period.eachDay().map((day) => {
      const date = this.toDateKey(day)
      return seriesByDate.get(date) ?? {
        date,
        count: 0,
        value: '0.0000',
      }
    })
  }

  private buildFilters(input: { sellerId?: number; branchId?: number; branchName?: string }): BudgetKpiDrilldownFilters {
    const filters: BudgetKpiDrilldownFilters = {}

    if (input.sellerId !== undefined) {
      filters.sellerId = input.sellerId
    }

    if (input.branchId !== undefined) {
      filters.branchId = input.branchId
    }

    if (input.branchName !== undefined) {
      filters.branchName = input.branchName
    }

    return filters
  }

  private toDrilldownRow(row: BudgetKpiDrilldownFactRow): BudgetKpiDrilldownRow {
    return {
      id: String(row.id),
      sourceTable: row.sourceTable,
      sourceRecordId: this.toCount(row.sourceRecordId),
      budgetDate: this.toDateKey(row.budgetDate),
      budgetDatetime: this.toTimestampText(row.budgetDatetime),
      closingDate: row.closingDate ? this.toDateKey(row.closingDate) : null,
      branchId: row.branchId,
      branchName: row.branchName,
      sellerId: this.toCount(row.sellerId),
      sellerName: row.sellerName,
      statusNormalized: row.statusNormalized,
      channel: row.channel,
      customerName: row.customerName,
      cpfCnpj: row.cpfCnpj,
      valueAmount: this.toText(row.valueAmount),
      sequential: row.sequential === null ? null : String(row.sequential),
      davId: String(row.davId),
      sequentialLinkedSale: row.sequentialLinkedSale === null ? null : String(row.sequentialLinkedSale),
      payloadJson: row.payloadJson,
    }
  }

  private toPeriod(input: BudgetKpiQueryPeriodInput): KpiPeriod {
    return KpiPeriod.between({
      from: input.from,
      to: input.to,
    })
  }

  private toPeriodView(period: KpiPeriod): BudgetKpiPeriodView {
    return {
      from: KpiPeriod.formatDateKey(period.from),
      to: KpiPeriod.formatDateKey(period.to),
      key: period.key,
    }
  }

  private isSummaryBucket(value: string): value is SummaryBucket {
    return value === 'total' || value === 'open' || value === 'won' || value === 'lost'
  }

  private normalizeStatus(value: string | null): 'OPEN' | 'WON' | 'LOST' | 'UNKNOWN' {
    const normalized = (value ?? 'UNKNOWN').toUpperCase()

    if (normalized === 'OPEN' || normalized === 'WON' || normalized === 'LOST') {
      return normalized
    }

    return 'UNKNOWN'
  }

  private toDateKey(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10)
    }

    return KpiPeriod.formatDateKey(value)
  }

  private toTimestampText(value: Date | string): string {
    if (typeof value === 'string') {
      return value
    }

    return value.toISOString()
  }

  private toCount(value: string | number | bigint): number {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : 0
  }

  private toText(value: string | number | bigint | Prisma.Decimal): string {
    return value instanceof Prisma.Decimal ? value.toString() : String(value)
  }

  private sumValues(facts: BudgetFactRecord[]): string {
    return facts
      .reduce(
        (accumulator, fact) => accumulator.add(new Prisma.Decimal(this.toText(fact.valueAmount))),
        new Prisma.Decimal(0),
      )
      .toFixed(4)
  }

  private normalizeSellerId(value: BudgetKpiQueryPeriodInput['sellerId']): number | undefined {
    return this.normalizeOptionalSafeInteger(value, 'sellerId')
  }

  private normalizeBranchId(value: BudgetKpiDrilldownInput['branchId']): number | undefined {
    return this.normalizeOptionalSafeInteger(value, 'branchId')
  }

  private normalizeOptionalSafeInteger(
    value: string | number | bigint | undefined,
    fieldName: 'sellerId' | 'branchId',
  ): number | undefined {
    if (value === undefined) {
      return undefined
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value) && Number.isSafeInteger(value)) {
        return value
      }

      throw new Error(`Invalid ${fieldName}: ${value}`)
    }

    if (typeof value === 'bigint') {
      const max = BigInt(Number.MAX_SAFE_INTEGER)
      const min = BigInt(Number.MIN_SAFE_INTEGER)

      if (value >= min && value <= max) {
        return Number(value)
      }

      throw new Error(`Invalid ${fieldName}: ${value.toString()}`)
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      throw new Error(`Invalid ${fieldName}: empty value`)
    }

    try {
      const parsed = BigInt(trimmed)
      const max = BigInt(Number.MAX_SAFE_INTEGER)
      const min = BigInt(Number.MIN_SAFE_INTEGER)

      if (parsed >= min && parsed <= max) {
        return Number(parsed)
      }
    } catch {
      // Fall through to the error below.
    }

    throw new Error(`Invalid ${fieldName}: ${value}`)
  }
}
