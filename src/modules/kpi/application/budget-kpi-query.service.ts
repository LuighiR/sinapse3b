import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { BranchScopeService } from '../../companies/application/branch-scope.service'
import { KpiPeriod } from '../domain/kpi-period'
import {
  BudgetFactRecord,
  BudgetKpiBreakdownRow,
  BudgetKpiSnapshotRow,
} from './budget-kpi-refresh.service'
import {
  classifyBudgetFollowUpRecord,
  followUpStatus,
  followUpWindow,
  type FollowUpStatus,
  type FollowUpWindow,
} from './budget-follow-up-classifier'

export type BudgetStatusFilter = 'Cancelado' | 'Baixado' | 'Pendente'

export type BudgetKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  branchId?: string | number | bigint
  sellerId?: string | number | bigint
  status?: BudgetStatusFilter
  orderType?: string
}

export type BudgetKpiFollowUpSummaryInput = Omit<BudgetKpiQueryPeriodInput, 'status'> & {
  referenceAt: string | Date
}

export type BudgetKpiFollowUpDailyInput = BudgetKpiFollowUpSummaryInput

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

export type BudgetKpiFollowUpDailyRow = {
  date: string
  window: FollowUpWindow
  status: FollowUpStatus
  count: number
  value: string
}

export type BudgetKpiFollowUpDailyResponse = {
  period: BudgetKpiPeriodView
  rows: BudgetKpiFollowUpDailyRow[]
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
  status?: BudgetStatusFilter
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
  cancellationDate: Date | string | null
  cancelationTime: string | null
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
  cancellationDate: string | null
  cancelationTime: string | null
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

export type BudgetKpiFollowUpDrilldownInput = BudgetKpiFollowUpSummaryInput & {
  date?: string
  followUpWindow?: FollowUpWindow
  followUpStatus?: FollowUpStatus
}

export type BudgetKpiFollowUpDrilldownFilters = {
  branchId?: number
  referenceAt: string
  date?: string
  followUpWindow?: FollowUpWindow
  followUpStatus?: FollowUpStatus
  sellerId?: number
  orderType?: string
}

export type BudgetKpiFollowUpDrilldownRow = BudgetKpiDrilldownRow & {
  followUpWindow: FollowUpWindow
  followUpStatus: FollowUpStatus
}

export type BudgetKpiFollowUpDrilldownResponse = {
  period: BudgetKpiPeriodView
  filters: BudgetKpiFollowUpDrilldownFilters
  rows: BudgetKpiFollowUpDrilldownRow[]
}

export type BudgetKpiQueryRepository = {
  getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiSnapshotRow[]>
  getDailyRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiBreakdownRow[]>
  getBudgetFactRows(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
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

const MISSING_ORDER_TYPE_LABEL = 'Nao identificado'

@Injectable()
export class BudgetKpiQueryService {
  constructor(
    private readonly repository: BudgetKpiQueryRepository,
    private readonly branchScopeService?: BranchScopeService,
  ) {}

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
    const facts = await this.getFollowUpFacts(input, period)

    return {
      period: this.toPeriodView(period),
      ...this.buildFollowUpSummaryFromFacts(facts, referenceAt),
    }
  }

  async getFollowUpDaily(input: BudgetKpiFollowUpDailyInput): Promise<BudgetKpiFollowUpDailyResponse> {
    const period = this.toPeriod(input)
    const referenceAt = this.parseReferenceAt(input.referenceAt)
    const facts = await this.getFollowUpFacts(input, period)

    return {
      period: this.toPeriodView(period),
      rows: this.buildFollowUpDailyFromFacts(period, facts, referenceAt),
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
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const status = input.status
    const rows = await this.repository.getDrilldownRows({
      clientId: input.clientId,
      period,
      sellerId,
      branchId,
      branchName: input.branchName,
    })
    const filteredRows = rows.filter((row) => {
      if (status !== undefined && this.normalizeStatusFilter(status) !== this.normalizeStatus(row.statusNormalized)) {
        return false
      }

      return true
    })

    return {
      period: this.toPeriodView(period),
      filters: this.buildFilters({ ...input, sellerId, branchId }),
      rows: filteredRows.map((row) => this.toDrilldownRow(row)),
    }
  }

  async getFollowUpDrilldown(input: BudgetKpiFollowUpDrilldownInput): Promise<BudgetKpiFollowUpDrilldownResponse> {
    const period = this.toPeriod(input)
    const referenceAt = this.parseReferenceAt(input.referenceAt)
    const sellerId = this.normalizeSellerId(input.sellerId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const rows = await this.repository.getDrilldownRows({
      clientId: input.clientId,
      period,
      sellerId,
      branchId,
    })
    const filteredRows = rows
      .map((row) => ({
        row,
        classification: classifyBudgetFollowUpRecord(
          {
            statusNormalized: row.statusNormalized,
            budgetDatetime: row.budgetDatetime,
            closingDate: row.closingDate,
            cancellationDate: row.cancellationDate,
            cancelationTime: row.cancelationTime,
            payloadJson: row.payloadJson,
          },
          referenceAt,
        ),
      }))
      .filter(({ row, classification }) => {
        if (input.orderType !== undefined && !this.matchesOrderTypeFilter(row.channel ?? null, input.orderType)) {
          return false
        }

        if (classification === null) {
          return false
        }

        if (input.date !== undefined && this.toDateKey(row.budgetDate) !== input.date) {
          return false
        }

        if (input.followUpWindow !== undefined && classification.window !== input.followUpWindow) {
          return false
        }

        if (input.followUpStatus !== undefined && classification.status !== input.followUpStatus) {
          return false
        }

        return true
      })
      .sort((left, right) => this.compareFollowUpDrilldownRows(left.row, right.row))

    return {
      period: this.toPeriodView(period),
      filters: this.buildFollowUpDrilldownFilters({
        referenceAt: input.referenceAt,
        date: input.date,
        followUpWindow: input.followUpWindow,
        followUpStatus: input.followUpStatus,
        sellerId,
        branchId,
        orderType: input.orderType,
      }),
      rows: filteredRows.map(({ row, classification }) => ({
        ...this.toDrilldownRow(row),
        followUpWindow: classification!.window,
        followUpStatus: classification!.status,
      })),
    }
  }

  private async getFilteredFacts(input: BudgetKpiQueryPeriodInput, period: KpiPeriod): Promise<BudgetFactRecord[]> {
    const sellerId = this.normalizeSellerId(input.sellerId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const facts = await this.repository.getBudgetFactRows({
      clientId: input.clientId,
      period,
      branchId,
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
    return (
      input.branchId !== undefined ||
      input.sellerId !== undefined ||
      input.status !== undefined ||
      input.orderType !== undefined
    )
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
    const grouped: Record<FollowUpWindow, Record<FollowUpStatus, BudgetFactRecord[]>> = {
      [followUpWindow.within24h]: {
        [followUpStatus.converted]: [] as BudgetFactRecord[],
        [followUpStatus.lost]: [] as BudgetFactRecord[],
        [followUpStatus.open]: [] as BudgetFactRecord[],
      },
      [followUpWindow.after24h]: {
        [followUpStatus.converted]: [] as BudgetFactRecord[],
        [followUpStatus.lost]: [] as BudgetFactRecord[],
        [followUpStatus.open]: [] as BudgetFactRecord[],
      },
    }

    for (const fact of facts) {
      const classification = classifyBudgetFollowUpRecord(
        {
          statusNormalized: fact.statusNormalized,
          budgetDatetime: fact.budgetDatetime,
          closingDate: fact.closingDate,
          cancellationDate: fact.cancellationDate,
          cancelationTime: fact.cancelationTime,
          payloadJson: fact.payloadJson,
        },
        referenceAt,
      )

      if (classification === null) {
        continue
      }

      grouped[classification.window][classification.status].push(fact)
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
      within24h: this.toFollowUpWindow(grouped[followUpWindow.within24h], overallCount),
      after24h: this.toFollowUpWindow(grouped[followUpWindow.after24h], overallCount),
    }
  }

  private buildFollowUpDailyFromFacts(
    period: KpiPeriod,
    facts: BudgetFactRecord[],
    referenceAt: Date,
  ): BudgetKpiFollowUpDailyRow[] {
    const order: Array<[FollowUpWindow, FollowUpStatus]> = [
      [followUpWindow.within24h, followUpStatus.converted],
      [followUpWindow.within24h, followUpStatus.lost],
      [followUpWindow.within24h, followUpStatus.open],
      [followUpWindow.after24h, followUpStatus.converted],
      [followUpWindow.after24h, followUpStatus.lost],
      [followUpWindow.after24h, followUpStatus.open],
    ]
    const grouped = new Map<string, BudgetKpiFollowUpDailyRow>()

    for (const day of period.eachDay()) {
      const date = this.toDateKey(day)

      for (const [window, status] of order) {
        const key = `${date}|${window}|${status}`
        grouped.set(key, {
          date,
          window,
          status,
          count: 0,
          value: '0.0000',
        })
      }
    }

    for (const fact of facts) {
      const classification = classifyBudgetFollowUpRecord(
        {
          statusNormalized: fact.statusNormalized,
          budgetDatetime: fact.budgetDatetime,
          closingDate: fact.closingDate,
          cancellationDate: fact.cancellationDate,
          cancelationTime: fact.cancelationTime,
          payloadJson: fact.payloadJson,
        },
        referenceAt,
      )

      if (classification === null) {
        continue
      }

      const date = this.toDateKey(fact.budgetDate)
      const key = `${date}|${classification.window}|${classification.status}`
      const current = grouped.get(key) ?? {
        date,
        window: classification.window,
        status: classification.status,
        count: 0,
        value: '0.0000',
      }

      current.count += 1
      current.value = this.addValue(current.value, fact.valueAmount)
      grouped.set(key, current)
    }

    return [...grouped.values()].sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date)
      }

      const windowOrder = this.compareFollowUpWindow(left.window, right.window)
      if (windowOrder !== 0) {
        return windowOrder
      }

      return this.compareFollowUpStatus(left.status, right.status)
    })
  }

  private async getFollowUpFacts(
    input: BudgetKpiFollowUpSummaryInput,
    period: KpiPeriod,
  ): Promise<BudgetFactRecord[]> {
    const sellerId = this.normalizeSellerId(input.sellerId)
    const branchId = await this.resolveBranchScope(input.clientId, input.branchId)
    const facts = await this.repository.getBudgetFactRows({
      clientId: input.clientId,
      period,
      branchId,
      sellerId,
    })

    return facts.filter((fact) => {
      if (input.orderType !== undefined && !this.matchesOrderTypeFilter(fact.channel ?? null, input.orderType)) {
        return false
      }

      return true
    })
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

  private buildFilters(input: {
    sellerId?: number
    status?: BudgetStatusFilter
    branchId?: number
    branchName?: string
  }): BudgetKpiDrilldownFilters {
    const filters: BudgetKpiDrilldownFilters = {}

    if (input.sellerId !== undefined) {
      filters.sellerId = input.sellerId
    }

    if (input.status !== undefined) {
      filters.status = input.status
    }

    if (input.branchId !== undefined) {
      filters.branchId = input.branchId
    }

    if (input.branchName !== undefined) {
      filters.branchName = input.branchName
    }

    return filters
  }

  private buildFollowUpDrilldownFilters(input: {
    referenceAt: string | Date
    date?: string
    followUpWindow?: FollowUpWindow
    followUpStatus?: FollowUpStatus
    sellerId?: number
    branchId?: number
    orderType?: string
  }): BudgetKpiFollowUpDrilldownFilters {
    const filters: BudgetKpiFollowUpDrilldownFilters = {
      referenceAt: this.toReferenceAtFilterValue(input.referenceAt),
    }

    if (input.branchId !== undefined) {
      filters.branchId = input.branchId
    }

    if (input.date !== undefined) {
      filters.date = input.date
    }

    if (input.followUpWindow !== undefined) {
      filters.followUpWindow = input.followUpWindow
    }

    if (input.followUpStatus !== undefined) {
      filters.followUpStatus = input.followUpStatus
    }

    if (input.sellerId !== undefined) {
      filters.sellerId = input.sellerId
    }

    if (input.orderType !== undefined) {
      filters.orderType = input.orderType
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
      cancellationDate: row.cancellationDate ? this.toDateKey(row.cancellationDate) : null,
      cancelationTime: row.cancelationTime ?? null,
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

  private compareFollowUpDrilldownRows(
    left: BudgetKpiDrilldownFactRow,
    right: BudgetKpiDrilldownFactRow,
  ): number {
    const budgetDatetimeDiff = this.toComparableTimestamp(right.budgetDatetime) - this.toComparableTimestamp(left.budgetDatetime)

    if (budgetDatetimeDiff !== 0) {
      return budgetDatetimeDiff
    }

    const budgetDateDiff = this.toComparableTimestamp(right.budgetDate) - this.toComparableTimestamp(left.budgetDate)

    if (budgetDateDiff !== 0) {
      return budgetDateDiff
    }

    return this.compareRecordIds(right.id, left.id)
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

  private compareFollowUpWindow(left: FollowUpWindow, right: FollowUpWindow): number {
    return this.followUpWindowOrder(left) - this.followUpWindowOrder(right)
  }

  private followUpWindowOrder(value: FollowUpWindow): number {
    if (value === followUpWindow.within24h) {
      return 0
    }

    return 1
  }

  private compareFollowUpStatus(left: FollowUpStatus, right: FollowUpStatus): number {
    return this.followUpStatusOrder(left) - this.followUpStatusOrder(right)
  }

  private followUpStatusOrder(value: FollowUpStatus): number {
    if (value === followUpStatus.converted) {
      return 0
    }

    if (value === followUpStatus.lost) {
      return 1
    }

    return 2
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
    input: Record<FollowUpStatus, BudgetFactRecord[]>,
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

  private sumValues(facts: BudgetFactRecord[]): string {
    return facts.reduce((accumulator, fact) => this.addValue(accumulator, fact.valueAmount), '0.0000')
  }

  private normalizeSellerId(value: BudgetKpiQueryPeriodInput['sellerId']): number | undefined {
    return this.normalizeOptionalSafeInteger(value, 'sellerId')
  }

  private async resolveBranchScope(
    clientId: string,
    value: BudgetKpiDrilldownInput['branchId'],
  ): Promise<number | undefined> {
    const branchId = this.normalizeBranchId(value)

    if (branchId !== undefined && this.branchScopeService !== undefined) {
      await this.branchScopeService.assertBranchScope(clientId, branchId)
    }

    return branchId
  }

  private normalizeBranchId(value: BudgetKpiDrilldownInput['branchId']): number | undefined {
    return this.normalizeOptionalSafeInteger(value, 'branchId')
  }

  private toReferenceAtFilterValue(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : value
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
