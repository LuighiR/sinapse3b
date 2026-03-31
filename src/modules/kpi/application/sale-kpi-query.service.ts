import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { KpiPeriod } from '../domain/kpi-period'
import { SaleFactRecord, SaleKpiBreakdownRow, SaleKpiSnapshotRow } from './sale-kpi-refresh.service'

export type SaleStatusFilter = 'Ativa' | 'Cancelada'

export type SaleKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  sellerId?: string | number | bigint
  status?: SaleStatusFilter
  orderType?: string
  hasLinkedBudget?: boolean
}

export type SaleKpiPeriodView = {
  from: string
  to: string
  key: string
}

export type SaleKpiSummaryCard = {
  count: number
  value: string
}

export type SaleKpiAverageDailyCard = {
  count: string
  value: string
}

export type SaleKpiAverageTicketCard = {
  value: string
}

export type SaleKpiSummaryResponse = {
  period: SaleKpiPeriodView
  total: SaleKpiSummaryCard
  active: SaleKpiSummaryCard
  canceled: SaleKpiSummaryCard
  averageDaily: SaleKpiAverageDailyCard
  averageTicket: SaleKpiAverageTicketCard
}

export type SaleKpiDailySeriesItem = {
  date: string
  count: number
  value: string
}

export type SaleKpiDailySeriesResponse = {
  period: SaleKpiPeriodView
  series: SaleKpiDailySeriesItem[]
}

export type SaleKpiChannelDailyRow = {
  date: string
  orderType: string
  count: number
  value: string
}

export type SaleKpiChannelDailyResponse = {
  period: SaleKpiPeriodView
  rows: SaleKpiChannelDailyRow[]
}

export type SaleKpiTicketAverageChannelRow = {
  orderType: string
  count: number
  value: string
  averageTicket: string
}

export type SaleKpiTicketAverageResponse = {
  period: SaleKpiPeriodView
  overall: {
    count: number
    value: string
    averageTicket: string
  }
  channels: SaleKpiTicketAverageChannelRow[]
}

export type SaleKpiDrilldownInput = SaleKpiQueryPeriodInput

export type SaleKpiDrilldownFilters = {
  sellerId?: number
  status?: SaleStatusFilter
  orderType?: string
  hasLinkedBudget?: boolean
}

export type SaleKpiDrilldownFactRow = {
  id: bigint | number | string
  clientId: string
  sourceTable: string
  sourceRecordId: number | string | bigint
  branchName: string
  branchId: number | null
  sellerId: number | string | bigint
  sellerName: string | null
  saleDate: Date | string
  saleDatetime: Date | string
  statusNormalized: string
  channel: string | null
  hasLinkedBudget: boolean
  linkedBudgetSourceRecordId: number | string | bigint | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string | number | bigint
  sequential: number | string | bigint | null
  invoiceSerie: number | string | bigint | null
  invoiceNumeric: number | string | bigint | null
  listDavsId: string | null
  payloadJson: Record<string, unknown> | null
}

export type SaleKpiDrilldownRow = {
  id: string
  sourceTable: string
  sourceRecordId: number
  saleDate: string
  saleDatetime: string
  branchId: number | null
  branchName: string
  sellerId: number
  sellerName: string | null
  statusNormalized: string
  channel: string | null
  hasLinkedBudget: boolean
  linkedBudgetSourceRecordId: number | null
  customerName: string
  cpfCnpj: string | null
  valueAmount: string
  sequential: string | null
  invoiceSerie: string | null
  invoiceNumeric: string | null
  listDavsId: string | null
  payloadJson: Record<string, unknown> | null
}

export type SaleKpiDrilldownResponse = {
  period: SaleKpiPeriodView
  filters: SaleKpiDrilldownFilters
  rows: SaleKpiDrilldownRow[]
}

export type SaleKpiQueryRepository = {
  getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<SaleKpiSnapshotRow[]>
  getDailyRows(input: { clientId: string; period: KpiPeriod }): Promise<SaleKpiBreakdownRow[]>
  getSaleFactRows(input: { clientId: string; period: KpiPeriod; sellerId?: number }): Promise<SaleFactRecord[]>
  getDrilldownRows(input: { clientId: string; period: KpiPeriod; sellerId?: number }): Promise<SaleKpiDrilldownFactRow[]>
}

type SaleSummaryBucket = 'total' | 'active' | 'canceled'
type NormalizedSaleStatus = 'VALID' | 'CANCELED' | 'UNKNOWN'

const MISSING_ORDER_TYPE_LABEL = 'Nao identificado'

@Injectable()
export class SaleKpiQueryService {
  constructor(private readonly repository: SaleKpiQueryRepository) {}

  async getSummary(input: SaleKpiQueryPeriodInput): Promise<SaleKpiSummaryResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const facts = await this.getFilteredFacts(input, period)

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(period, facts),
      }
    }

    const rows = await this.repository.getSummaryRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallbackToFactsForSummary(rows)) {
      const facts = await this.getFilteredFacts(input, period)

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(period, facts),
      }
    }

    const summary = this.createEmptySummary()

    for (const row of rows) {
      if (row.metricKey === 'average_daily.count') {
        summary.averageDaily.count = this.toText(row.metricValue)
        continue
      }

      if (row.metricKey === 'average_daily.value') {
        summary.averageDaily.value = this.toText(row.metricValue)
        continue
      }

      if (row.metricKey === 'average_ticket.value') {
        summary.averageTicket.value = this.toText(row.metricValue)
        continue
      }

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
      active: summary.active,
      canceled: summary.canceled,
      averageDaily: summary.averageDaily,
      averageTicket: summary.averageTicket,
    }
  }

  async getDailySeries(input: SaleKpiQueryPeriodInput): Promise<SaleKpiDailySeriesResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const facts = await this.getFilteredFacts(input, period)

      return {
        period: this.toPeriodView(period),
        series: this.buildDailySeriesFromFacts(period, facts),
      }
    }

    const rows = await this.repository.getDailyRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallbackToFactsForDaily(rows)) {
      const facts = await this.getFilteredFacts(input, period)

      return {
        period: this.toPeriodView(period),
        series: this.buildDailySeriesFromFacts(period, facts),
      }
    }

    const seriesByDate = new Map<string, SaleKpiDailySeriesItem>()

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
      series: period.eachDay().map((day) => {
        const date = this.toDateKey(day)
        return seriesByDate.get(date) ?? { date, count: 0, value: '0.0000' }
      }),
    }
  }

  async getChannelDaily(input: SaleKpiQueryPeriodInput): Promise<SaleKpiChannelDailyResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(input, period)
    const grouped = new Map<string, SaleKpiChannelDailyRow>()

    for (const fact of facts) {
      const date = this.toDateKey(fact.saleDate)
      const orderType = this.toOrderTypeLabel(fact.channel ?? null)
      const key = `${date}|${orderType}`
      const current = grouped.get(key) ?? {
        date,
        orderType,
        count: 0,
        value: '0.0000',
      }

      current.count += 1
      current.value = this.addValue(current.value, fact.valueAmount)
      grouped.set(key, current)
    }

    return {
      period: this.toPeriodView(period),
      rows: [...grouped.values()].sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date)
        }

        return left.orderType.localeCompare(right.orderType)
      }),
    }
  }

  async getTicketAverage(input: SaleKpiQueryPeriodInput): Promise<SaleKpiTicketAverageResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(input, period)
    const grouped = new Map<string, SaleFactRecord[]>()

    for (const fact of facts) {
      const key = this.toOrderTypeLabel(fact.channel ?? null)
      const bucket = grouped.get(key)

      if (bucket) {
        bucket.push(fact)
      } else {
        grouped.set(key, [fact])
      }
    }

    return {
      period: this.toPeriodView(period),
      overall: {
        count: facts.length,
        value: this.sumValues(facts),
        averageTicket: this.averageTicket(facts),
      },
      channels: [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([orderType, channelFacts]) => ({
          orderType,
          count: channelFacts.length,
          value: this.sumValues(channelFacts),
          averageTicket: this.averageTicket(channelFacts),
        })),
    }
  }

  async getDrilldown(input: SaleKpiDrilldownInput): Promise<SaleKpiDrilldownResponse> {
    const period = this.toPeriod(input)
    const sellerId = this.normalizeSellerId(input.sellerId)
    const rows = await this.repository.getDrilldownRows({
      clientId: input.clientId,
      period,
      sellerId,
    })
    const filteredRows = rows
      .filter((row) => {
        if (input.status !== undefined && this.normalizeStatusFilter(input.status) !== this.normalizeStatus(row.statusNormalized)) {
          return false
        }

        if (input.orderType !== undefined && !this.matchesOrderTypeFilter(row.channel ?? null, input.orderType)) {
          return false
        }

        if (input.hasLinkedBudget !== undefined && row.hasLinkedBudget !== input.hasLinkedBudget) {
          return false
        }

        return true
      })
      .sort((left, right) => this.compareDrilldownRows(left, right))

    return {
      period: this.toPeriodView(period),
      filters: this.buildDrilldownFilters({ ...input, sellerId }),
      rows: filteredRows.map((row) => this.toDrilldownRow(row)),
    }
  }

  private async getFilteredFacts(input: SaleKpiQueryPeriodInput, period: KpiPeriod): Promise<SaleFactRecord[]> {
    const sellerId = this.normalizeSellerId(input.sellerId)
    const facts = await this.repository.getSaleFactRows({
      clientId: input.clientId,
      period,
      sellerId,
    })

    return facts.filter((fact) => {
      if (input.status !== undefined && this.normalizeStatusFilter(input.status) !== this.normalizeStatus(fact.statusNormalized)) {
        return false
      }

      if (input.orderType !== undefined && !this.matchesOrderTypeFilter(fact.channel ?? null, input.orderType)) {
        return false
      }

      if (input.hasLinkedBudget !== undefined && fact.hasLinkedBudget !== input.hasLinkedBudget) {
        return false
      }

      return true
    })
  }

  private hasFactFilters(input: SaleKpiQueryPeriodInput): boolean {
    return (
      input.sellerId !== undefined ||
      input.status !== undefined ||
      input.orderType !== undefined ||
      input.hasLinkedBudget !== undefined
    )
  }

  private buildDrilldownFilters(input: {
    sellerId?: number
    status?: SaleStatusFilter
    orderType?: string
    hasLinkedBudget?: boolean
  }): SaleKpiDrilldownFilters {
    const filters: SaleKpiDrilldownFilters = {}

    if (input.sellerId !== undefined) {
      filters.sellerId = input.sellerId
    }

    if (input.status !== undefined) {
      filters.status = input.status
    }

    if (input.orderType !== undefined) {
      filters.orderType = input.orderType
    }

    if (input.hasLinkedBudget !== undefined) {
      filters.hasLinkedBudget = input.hasLinkedBudget
    }

    return filters
  }

  private buildSummaryFromFacts(period: KpiPeriod, facts: SaleFactRecord[]) {
    const activeFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'VALID')
    const canceledFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'CANCELED')

    return {
      total: {
        count: facts.length,
        value: this.sumValues(facts),
      },
      active: {
        count: activeFacts.length,
        value: this.sumValues(activeFacts),
      },
      canceled: {
        count: canceledFacts.length,
        value: this.sumValues(canceledFacts),
      },
      averageDaily: {
        count: this.averageCountPerDay(period, facts),
        value: this.averageValuePerDay(period, facts),
      },
      averageTicket: {
        value: this.averageTicket(facts),
      },
    }
  }

  private createEmptySummary(): {
    total: SaleKpiSummaryCard
    active: SaleKpiSummaryCard
    canceled: SaleKpiSummaryCard
    averageDaily: SaleKpiAverageDailyCard
    averageTicket: SaleKpiAverageTicketCard
  } {
    return {
      total: { count: 0, value: '0.0000' },
      active: { count: 0, value: '0.0000' },
      canceled: { count: 0, value: '0.0000' },
      averageDaily: { count: '0.0000', value: '0.0000' },
      averageTicket: { value: '0.0000' },
    }
  }

  private toDrilldownRow(row: SaleKpiDrilldownFactRow): SaleKpiDrilldownRow {
    return {
      id: String(row.id),
      sourceTable: row.sourceTable,
      sourceRecordId: this.toCount(row.sourceRecordId),
      saleDate: this.toDateKey(row.saleDate),
      saleDatetime: this.toTimestampText(row.saleDatetime),
      branchId: row.branchId,
      branchName: row.branchName,
      sellerId: this.toCount(row.sellerId),
      sellerName: row.sellerName,
      statusNormalized: row.statusNormalized,
      channel: row.channel,
      hasLinkedBudget: row.hasLinkedBudget,
      linkedBudgetSourceRecordId:
        row.linkedBudgetSourceRecordId === null ? null : this.toCount(row.linkedBudgetSourceRecordId),
      customerName: row.customerName,
      cpfCnpj: row.cpfCnpj,
      valueAmount: this.toText(row.valueAmount),
      sequential: row.sequential === null ? null : String(row.sequential),
      invoiceSerie: row.invoiceSerie === null ? null : String(row.invoiceSerie),
      invoiceNumeric: row.invoiceNumeric === null ? null : String(row.invoiceNumeric),
      listDavsId: row.listDavsId,
      payloadJson: row.payloadJson,
    }
  }

  private compareDrilldownRows(left: SaleKpiDrilldownFactRow, right: SaleKpiDrilldownFactRow): number {
    const saleDatetimeDiff = this.toComparableTimestamp(right.saleDatetime) - this.toComparableTimestamp(left.saleDatetime)

    if (saleDatetimeDiff !== 0) {
      return saleDatetimeDiff
    }

    const saleDateDiff = this.toComparableTimestamp(right.saleDate) - this.toComparableTimestamp(left.saleDate)

    if (saleDateDiff !== 0) {
      return saleDateDiff
    }

    return this.compareRecordIds(right.id, left.id)
  }

  private buildDailySeriesFromFacts(period: KpiPeriod, facts: SaleFactRecord[]): SaleKpiDailySeriesItem[] {
    const seriesByDate = new Map<string, SaleKpiDailySeriesItem>()

    for (const day of period.eachDay()) {
      const date = this.toDateKey(day)
      seriesByDate.set(date, { date, count: 0, value: '0.0000' })
    }

    for (const fact of facts) {
      const date = this.toDateKey(fact.saleDate)
      const current = seriesByDate.get(date) ?? { date, count: 0, value: '0.0000' }
      current.count += 1
      current.value = this.addValue(current.value, fact.valueAmount)
      seriesByDate.set(date, current)
    }

    return period.eachDay().map((day) => {
      const date = this.toDateKey(day)
      return seriesByDate.get(date) ?? { date, count: 0, value: '0.0000' }
    })
  }

  private toPeriod(input: SaleKpiQueryPeriodInput): KpiPeriod {
    return KpiPeriod.between({
      from: input.from,
      to: input.to,
    })
  }

  private toPeriodView(period: KpiPeriod): SaleKpiPeriodView {
    return {
      from: KpiPeriod.formatDateKey(period.from),
      to: KpiPeriod.formatDateKey(period.to),
      key: period.key,
    }
  }

  private normalizeStatus(value: string | null): NormalizedSaleStatus {
    const normalized = (value ?? 'UNKNOWN').toUpperCase()

    if (normalized === 'VALID' || normalized === 'CANCELED') {
      return normalized
    }

    return 'UNKNOWN'
  }

  private normalizeStatusFilter(value: SaleStatusFilter): Exclude<NormalizedSaleStatus, 'UNKNOWN'> {
    if (value === 'Ativa') {
      return 'VALID'
    }

    return 'CANCELED'
  }

  private matchesOrderTypeFilter(channel: string | null, orderTypeFilter: string): boolean {
    return this.normalizeLabelForComparison(this.toOrderTypeLabel(channel)) === this.normalizeLabelForComparison(orderTypeFilter)
  }

  private toOrderTypeLabel(channel: string | null): string {
    if (channel == null || channel.trim() === '') {
      return MISSING_ORDER_TYPE_LABEL
    }

    return channel
  }

  private normalizeLabelForComparison(value: string): string {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
  }

  private isSummaryBucket(value: string): value is SaleSummaryBucket {
    return value === 'total' || value === 'active' || value === 'canceled'
  }

  private shouldFallbackToFactsForSummary(rows: SaleKpiSnapshotRow[]): boolean {
    if (rows.length === 0) {
      return true
    }

    return rows.every((row) => this.isZeroMetricValue(row.metricValue))
  }

  private shouldFallbackToFactsForDaily(rows: SaleKpiBreakdownRow[]): boolean {
    if (rows.length === 0) {
      return true
    }

    return rows.every((row) => this.isZeroMetricValue(row.metricValue))
  }

  private isZeroMetricValue(value: string | number | bigint | Prisma.Decimal): boolean {
    return new Prisma.Decimal(this.toText(value)).equals(0)
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

  private toComparableTimestamp(value: Date | string): number {
    if (value instanceof Date) {
      return value.getTime()
    }

    return new Date(value).getTime()
  }

  private compareRecordIds(left: string | number | bigint, right: string | number | bigint): number {
    const leftBigInt = this.toComparableBigInt(left)
    const rightBigInt = this.toComparableBigInt(right)

    if (leftBigInt !== null && rightBigInt !== null) {
      if (leftBigInt > rightBigInt) {
        return 1
      }

      if (leftBigInt < rightBigInt) {
        return -1
      }

      return 0
    }

    return String(left).localeCompare(String(right))
  }

  private toComparableBigInt(value: string | number | bigint): bigint | null {
    try {
      return BigInt(value)
    } catch {
      return null
    }
  }

  private toCount(value: string | number | bigint): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private toText(value: string | number | bigint | Prisma.Decimal): string {
    return value instanceof Prisma.Decimal ? value.toString() : String(value)
  }

  private addValue(currentValue: string, nextValue: string | number | bigint | Prisma.Decimal): string {
    return new Prisma.Decimal(currentValue).add(new Prisma.Decimal(this.toText(nextValue))).toFixed(4)
  }

  private sumValues(facts: SaleFactRecord[]): string {
    return facts.reduce((accumulator, fact) => this.addValue(accumulator, fact.valueAmount), '0.0000')
  }

  private averageCountPerDay(period: KpiPeriod, facts: SaleFactRecord[]): string {
    return new Prisma.Decimal(facts.length).div(period.eachDay().length).toFixed(4)
  }

  private averageValuePerDay(period: KpiPeriod, facts: SaleFactRecord[]): string {
    return new Prisma.Decimal(this.sumValues(facts)).div(period.eachDay().length).toFixed(4)
  }

  private averageTicket(facts: SaleFactRecord[]): string {
    if (facts.length === 0) {
      return '0.0000'
    }

    return new Prisma.Decimal(this.sumValues(facts)).div(facts.length).toFixed(4)
  }

  private normalizeSellerId(value: SaleKpiQueryPeriodInput['sellerId']): number | undefined {
    if (value === undefined) {
      return undefined
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value) && Number.isSafeInteger(value)) {
        return value
      }

      throw new Error(`Invalid sellerId: ${value}`)
    }

    if (typeof value === 'bigint') {
      const max = BigInt(Number.MAX_SAFE_INTEGER)
      const min = BigInt(Number.MIN_SAFE_INTEGER)

      if (value >= min && value <= max) {
        return Number(value)
      }

      throw new Error(`Invalid sellerId: ${value.toString()}`)
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      throw new Error('Invalid sellerId: empty value')
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

    throw new Error(`Invalid sellerId: ${value}`)
  }
}
