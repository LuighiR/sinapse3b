import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { KpiPeriod } from '../domain/kpi-period'
import {
  BudgetFactRecord,
  BudgetKpiBreakdownRow,
  BudgetKpiSnapshotRow,
} from './budget-kpi-refresh.service'

export type BudgetStatusFilter = 'Cancelado' | 'Baixado' | 'Pendente'

export type BudgetKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  sellerId?: string | number | bigint
  status?: BudgetStatusFilter
  orderType?: string
}

export type BudgetKpiFollowUpSummaryInput = Omit<BudgetKpiQueryPeriodInput, 'status'> & {
  referenceAt: string | Date
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

export type BudgetKpiFollowUpMetric = {
  count: number
  value: string
  percentage: string
}

export type BudgetKpiFollowUpWindow = {
  total: BudgetKpiSummaryCard
  converted: BudgetKpiFollowUpMetric
  lost: BudgetKpiFollowUpMetric
  open: BudgetKpiFollowUpMetric
}

export type BudgetKpiFollowUpSummaryResponse = {
  period: BudgetKpiPeriodView
  total: BudgetKpiSummaryCard
  within24h: BudgetKpiFollowUpWindow
  after24h: BudgetKpiFollowUpWindow
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

export type BudgetKpiHourlySeriesItem = {
  hour: string
  count: number
  value: string
}

export type BudgetKpiHourlySeriesResponse = {
  period: BudgetKpiPeriodView
  series: BudgetKpiHourlySeriesItem[]
}

export type BudgetKpiChannelDailyRow = {
  date: string
  orderType: string
  count: number
  value: string
}

export type BudgetKpiChannelDailyResponse = {
  period: BudgetKpiPeriodView
  rows: BudgetKpiChannelDailyRow[]
}

export type BudgetKpiChannelHourlyRow = {
  hour: string
  orderType: string
  count: number
  value: string
}

export type BudgetKpiChannelHourlyResponse = {
  period: BudgetKpiPeriodView
  rows: BudgetKpiChannelHourlyRow[]
}

export type BudgetKpiChannelAbandonmentRow = {
  orderType: string
  count: number
  value: string
}

export type BudgetKpiChannelAbandonmentResponse = {
  period: BudgetKpiPeriodView
  rows: BudgetKpiChannelAbandonmentRow[]
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
    sellerId?: number
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
type NormalizedBudgetStatus = 'OPEN' | 'WON' | 'LOST' | 'UNKNOWN'
type FollowUpStatusBucket = 'converted' | 'lost' | 'open'
type FollowUpWindowBucket = 'within24h' | 'after24h'

const MISSING_ORDER_TYPE_LABEL = 'Nao identificado'
const FOLLOW_UP_WINDOW_LIMIT_MS = 24 * 60 * 60 * 1000

@Injectable()
export class BudgetKpiQueryService {
  constructor(private readonly repository: BudgetKpiQueryRepository) {}

  async getSummary(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiSummaryResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const facts = await this.getFilteredFacts(input, period)

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(facts),
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
        ...this.buildSummaryFromFacts(facts),
      }
    }

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
      series: this.zeroFilledDailySeries(period, seriesByDate),
    }
  }

  async getHourlySeries(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiHourlySeriesResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(input, period)

    return {
      period: this.toPeriodView(period),
      series: this.buildHourlySeriesFromFacts(facts),
    }
  }

  async getFollowUpSummary(input: BudgetKpiFollowUpSummaryInput): Promise<BudgetKpiFollowUpSummaryResponse> {
    const period = this.toPeriod(input)
    const referenceAt = this.parseReferenceAt(input.referenceAt)
    const sellerId = this.normalizeSellerId(input.sellerId)
    const facts = await this.repository.getBudgetFactRows({
      clientId: input.clientId,
      period,
      sellerId,
    })
    const filteredFacts = facts.filter((fact) => {
      if (input.orderType !== undefined && !this.matchesOrderTypeFilter(fact.channel ?? null, input.orderType)) {
        return false
      }

      return true
    })

    return {
      period: this.toPeriodView(period),
      ...this.buildFollowUpSummaryFromFacts(filteredFacts, referenceAt),
    }
  }

  async getChannelDaily(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiChannelDailyResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(input, period)
    const grouped = new Map<string, BudgetKpiChannelDailyRow>()

    for (const fact of facts) {
      const date = this.toDateKey(fact.budgetDate)
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

  async getChannelHourly(input: BudgetKpiQueryPeriodInput): Promise<BudgetKpiChannelHourlyResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(input, period)
    const grouped = new Map<string, BudgetKpiChannelHourlyRow>()

    for (const fact of facts) {
      const hour = this.toHourKey(fact.budgetDatetime)
      const orderType = this.toOrderTypeLabel(fact.channel ?? null)
      const key = `${hour}|${orderType}`
      const current = grouped.get(key) ?? {
        hour,
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
        if (left.hour !== right.hour) {
          return left.hour.localeCompare(right.hour)
        }

        return left.orderType.localeCompare(right.orderType)
      }),
    }
  }

  async getChannelAbandonment(input: Omit<BudgetKpiQueryPeriodInput, 'status'>): Promise<BudgetKpiChannelAbandonmentResponse> {
    const period = this.toPeriod(input)
    const facts = await this.getFilteredFacts(
      {
        ...input,
        status: 'Cancelado',
      },
      period,
    )
    const grouped = new Map<string, BudgetKpiChannelAbandonmentRow>()

    for (const fact of facts) {
      const orderType = this.toOrderTypeLabel(fact.channel ?? null)
      const current = grouped.get(orderType) ?? {
        orderType,
        count: 0,
        value: '0.0000',
      }

      current.count += 1
      current.value = this.addValue(current.value, fact.valueAmount)
      grouped.set(orderType, current)
    }

    return {
      period: this.toPeriodView(period),
      rows: [...grouped.values()].sort((left, right) => left.orderType.localeCompare(right.orderType)),
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

  private async getFilteredFacts(input: BudgetKpiQueryPeriodInput, period: KpiPeriod): Promise<BudgetFactRecord[]> {
    const sellerId = this.normalizeSellerId(input.sellerId)
    const facts = await this.repository.getBudgetFactRows({
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

      return true
    })
  }

  private hasFactFilters(input: BudgetKpiQueryPeriodInput): boolean {
    return input.sellerId !== undefined || input.status !== undefined || input.orderType !== undefined
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

  private buildFollowUpSummaryFromFacts(
    facts: BudgetFactRecord[],
    referenceAt: Date,
  ): Omit<BudgetKpiFollowUpSummaryResponse, 'period'> {
    const grouped = {
      within24h: {
        converted: [] as BudgetFactRecord[],
        lost: [] as BudgetFactRecord[],
        open: [] as BudgetFactRecord[],
      },
      after24h: {
        converted: [] as BudgetFactRecord[],
        lost: [] as BudgetFactRecord[],
        open: [] as BudgetFactRecord[],
      },
    }

    for (const fact of facts) {
      const status = this.normalizeStatus(fact.statusNormalized)

      if (status === 'UNKNOWN') {
        continue
      }

      const openedAt = this.toTimestamp(fact.budgetDatetime)

      if (openedAt === null) {
        continue
      }

      if (openedAt.getTime() > referenceAt.getTime()) {
        continue
      }

      const { bucket, statusBucket } = this.resolveFollowUpClassification(fact, status, openedAt, referenceAt)

      grouped[bucket][statusBucket].push(fact)
    }

    const within24hFacts = [
      ...grouped.within24h.converted,
      ...grouped.within24h.lost,
      ...grouped.within24h.open,
    ]
    const after24hFacts = [...grouped.after24h.converted, ...grouped.after24h.lost, ...grouped.after24h.open]
    const allFacts = [...within24hFacts, ...after24hFacts]
    const overallCount = allFacts.length

    return {
      total: this.toSummaryCardFromFacts(allFacts),
      within24h: this.toFollowUpWindow(grouped.within24h, overallCount),
      after24h: this.toFollowUpWindow(grouped.after24h, overallCount),
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
      current.value = this.addValue(current.value, fact.valueAmount)
      seriesByDate.set(date, current)
    }

    return this.zeroFilledDailySeries(period, seriesByDate)
  }

  private buildHourlySeriesFromFacts(facts: BudgetFactRecord[]): BudgetKpiHourlySeriesItem[] {
    const seriesByHour = new Map<string, BudgetKpiHourlySeriesItem>()

    for (let hour = 0; hour < 24; hour += 1) {
      const key = String(hour).padStart(2, '0')
      seriesByHour.set(key, {
        hour: key,
        count: 0,
        value: '0.0000',
      })
    }

    for (const fact of facts) {
      const hour = this.toHourKey(fact.budgetDatetime)
      const current = seriesByHour.get(hour) ?? {
        hour,
        count: 0,
        value: '0.0000',
      }

      current.count += 1
      current.value = this.addValue(current.value, fact.valueAmount)
      seriesByHour.set(hour, current)
    }

    return [...seriesByHour.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private zeroFilledDailySeries(
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

  private shouldFallbackToFactsForSummary(rows: BudgetKpiSnapshotRow[]): boolean {
    if (rows.length === 0) {
      return true
    }

    return rows.every((row) => this.isZeroMetricValue(row.metricValue))
  }

  private shouldFallbackToFactsForDaily(rows: BudgetKpiBreakdownRow[]): boolean {
    if (rows.length === 0) {
      return true
    }

    return rows.every((row) => this.isZeroMetricValue(row.metricValue))
  }

  private isZeroMetricValue(value: string | number | bigint | Prisma.Decimal): boolean {
    return new Prisma.Decimal(this.toText(value)).equals(0)
  }

  private normalizeStatus(value: string | null): NormalizedBudgetStatus {
    const normalized = (value ?? 'UNKNOWN').toUpperCase()

    if (normalized === 'OPEN' || normalized === 'WON' || normalized === 'LOST') {
      return normalized
    }

    return 'UNKNOWN'
  }

  private toFollowUpStatusBucket(status: Exclude<NormalizedBudgetStatus, 'UNKNOWN'>): FollowUpStatusBucket {
    if (status === 'WON') {
      return 'converted'
    }

    if (status === 'LOST') {
      return 'lost'
    }

    return 'open'
  }

  private resolveFollowUpClassification(
    fact: BudgetFactRecord,
    status: Exclude<NormalizedBudgetStatus, 'UNKNOWN'>,
    openedAt: Date,
    referenceAt: Date,
  ): { bucket: FollowUpWindowBucket; statusBucket: FollowUpStatusBucket } {
    const closingAt = this.resolveClosingTimestamp(fact)

    if ((status === 'WON' || status === 'LOST') && closingAt !== null && closingAt.getTime() <= referenceAt.getTime()) {
      return {
        bucket: this.toFollowUpWindowBucket(closingAt, openedAt),
        statusBucket: this.toFollowUpStatusBucket(status),
      }
    }

    return {
      bucket: this.toFollowUpWindowBucket(referenceAt, openedAt),
      statusBucket: 'open',
    }
  }

  private toFollowUpWindowBucket(reference: Date, openedAt: Date): FollowUpWindowBucket {
    const elapsedMs = Math.max(0, reference.getTime() - openedAt.getTime())

    return elapsedMs <= FOLLOW_UP_WINDOW_LIMIT_MS ? 'within24h' : 'after24h'
  }

  private resolveClosingTimestamp(fact: BudgetFactRecord): Date | null {
    if (fact.closingDate == null) {
      return null
    }

    const closingDate = this.toSaoPauloDayStart(fact.closingDate)
    const closingTime = this.readClosingTimeValue(fact.payloadJson ?? null)

    if (closingTime === null) {
      return null
    }

    const timeParts = this.parseTimeParts(closingTime)

    if (timeParts === null) {
      return null
    }

    const [hours, minutes, seconds] = timeParts
    return new Date(
      Date.UTC(
        closingDate.getUTCFullYear(),
        closingDate.getUTCMonth(),
        closingDate.getUTCDate(),
        hours + KpiPeriod.saoPauloUtcOffsetHours,
        minutes,
        seconds,
      ),
    )
  }

  private readClosingTimeValue(payloadJson: Record<string, unknown> | null): string | null {
    if (payloadJson === null) {
      return null
    }

    const value = payloadJson.closing_time ?? payloadJson.closingTime

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }

    return null
  }

  private parseTimeParts(value: string): [number, number, number] | null {
    const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)

    if (!match) {
      return null
    }

    return [Number(match[1]), Number(match[2]), Number(match[3] ?? '0')]
  }

  private toSaoPauloDayStart(value: Date | string): Date {
    if (typeof value === 'string') {
      const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number(part))

      return new Date(Date.UTC(year, month - 1, day, KpiPeriod.saoPauloUtcOffsetHours))
    }

    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        KpiPeriod.saoPauloUtcOffsetHours,
      ),
    )
  }

  private endOfSaoPauloDay(value: Date): Date {
    return new Date(value.getTime() + FOLLOW_UP_WINDOW_LIMIT_MS - 1)
  }

  private parseReferenceAt(value: string | Date): Date {
    if (value instanceof Date) {
      return value
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      throw new BadRequestException('Invalid budget follow-up summary query params')
    }

    const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)
      ? trimmed
      : /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)
        ? `${(trimmed.length === 16 ? `${trimmed}:00` : trimmed).replace(' ', 'T')}-03:00`
        : trimmed
    const parsed = new Date(normalized)

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid budget follow-up summary query params')
    }

    return parsed
  }

  private toTimestamp(value: Date | string | undefined): Date | null {
    if (value === undefined) {
      return null
    }

    if (value instanceof Date) {
      return value
    }

    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  private toFollowUpWindow(
    input: Record<FollowUpStatusBucket, BudgetFactRecord[]>,
    overallCount: number,
  ): BudgetKpiFollowUpWindow {
    const windowFacts = [...input.converted, ...input.lost, ...input.open]

    return {
      total: this.toSummaryCardFromFacts(windowFacts),
      converted: this.toFollowUpMetric(input.converted, overallCount),
      lost: this.toFollowUpMetric(input.lost, overallCount),
      open: this.toFollowUpMetric(input.open, overallCount),
    }
  }

  private toFollowUpMetric(facts: BudgetFactRecord[], overallCount: number): BudgetKpiFollowUpMetric {
    return {
      count: facts.length,
      value: this.sumValues(facts),
      percentage: overallCount === 0 ? '0.00' : ((facts.length / overallCount) * 100).toFixed(2),
    }
  }

  private toSummaryCardFromFacts(facts: BudgetFactRecord[]): BudgetKpiSummaryCard {
    return {
      count: facts.length,
      value: this.sumValues(facts),
    }
  }

  private normalizeStatusFilter(value: BudgetStatusFilter): Exclude<NormalizedBudgetStatus, 'UNKNOWN'> {
    if (value === 'Baixado') {
      return 'WON'
    }

    if (value === 'Pendente') {
      return 'OPEN'
    }

    return 'LOST'
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
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase()
  }

  private toDateKey(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10)
    }

    return KpiPeriod.formatDateKey(value)
  }

  private toHourKey(value: Date | string | undefined): string {
    if (value === undefined) {
      return '00'
    }

    if (typeof value === 'string') {
      const match = value.match(/(?:T|\s)(\d{2}):/)
      return match ? match[1] : '00'
    }

    return String(value.getUTCHours()).padStart(2, '0')
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

  private addValue(currentValue: string, nextValue: string | number | bigint | Prisma.Decimal): string {
    return new Prisma.Decimal(currentValue).add(new Prisma.Decimal(this.toText(nextValue))).toFixed(4)
  }

  private sumValues(facts: BudgetFactRecord[]): string {
    return facts.reduce((accumulator, fact) => this.addValue(accumulator, fact.valueAmount), '0.0000')
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
