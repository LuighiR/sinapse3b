import { Injectable } from '@nestjs/common'
import { KpiPeriod } from '../domain/kpi-period'
import {
  CallFactRecord,
  CallKpiBreakdownRow,
  CallKpiSnapshotRow,
  TelemarketingBudgetFactRecord,
} from './call-kpi-refresh.service'

export type CallKpiQueryPeriodInput = {
  clientId: string
  from: string | Date
  to: string | Date
  sellerId?: string | number | bigint
}

export type CallSellerFilterEmployee = {
  id: number
  name: string
  extensionNumber: string | null
  extensionUuid: string | null
}

export type CallKpiPeriodView = {
  from: string
  to: string
  key: string
}

export type CallKpiSummaryResponse = {
  period: CallKpiPeriodView
  received: { count: number }
  lost: { count: number }
  totalInbound: { count: number }
  telemarketingOpenBudgets: { count: number }
  peakHour: { hour: string; totalInboundCount: number }
}

export type CallKpiHourlyRow = {
  hour: string
  receivedCount: number
  lostCount: number
  totalInboundCount: number
}

export type CallKpiHourlyResponse = {
  period: CallKpiPeriodView
  rows: CallKpiHourlyRow[]
}

export type CallKpiAgentRankingRow = {
  agentType: 'EMPLOYEE' | 'EXTENSION'
  agentKey: string
  agentLabel: string
  employeeName: string | null
  extensionNumber: string | null
  receivedCount: number
  lostCount: number
  totalInboundCount: number
}

export type CallKpiAgentRankingResponse = {
  period: CallKpiPeriodView
  rows: CallKpiAgentRankingRow[]
}

export type CallKpiHourlyComparisonRow = {
  hour: string
  receivedCount: number
  lostCount: number
  telemarketingBudgetCount: number
}

export type CallKpiHourlyComparisonResponse = {
  period: CallKpiPeriodView
  rows: CallKpiHourlyComparisonRow[]
}

export type CallKpiQueryRepository = {
  getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiSnapshotRow[]>
  getHourlyRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiBreakdownRow[]>
  getAgentRankingRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiBreakdownRow[]>
  getHourlyComparisonRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiBreakdownRow[]>
  getCallFactRows(input: { clientId: string; period: KpiPeriod }): Promise<CallFactRecord[]>
  getTelemarketingBudgetRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<TelemarketingBudgetFactRecord[]>
  getEmployeeBySellerId(input: { clientId: string; sellerId: number }): Promise<CallSellerFilterEmployee | null>
}

type RankingBucket = {
  agentType: 'EMPLOYEE' | 'EXTENSION'
  agentKey: string
  agentLabel: string
  employeeName: string | null
  extensionNumber: string | null
  receivedCount: number
  lostCount: number
  totalInboundCount: number
}

@Injectable()
export class CallKpiQueryService {
  constructor(private readonly repository: CallKpiQueryRepository) {}

  async getSummary(input: CallKpiQueryPeriodInput): Promise<CallKpiSummaryResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.getFilteredFacts(input, period),
        this.repository.getTelemarketingBudgetRows({ clientId: input.clientId, period }),
      ])

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(callFacts, telemarketingBudgetRows),
      }
    }

    const rows = await this.repository.getSummaryRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallback(rows)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.repository.getCallFactRows({ clientId: input.clientId, period }),
        this.repository.getTelemarketingBudgetRows({ clientId: input.clientId, period }),
      ])

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(callFacts, telemarketingBudgetRows),
      }
    }

    return {
      period: this.toPeriodView(period),
      ...this.buildSummaryFromRows(rows),
    }
  }

  async getHourly(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const callFacts = await this.getFilteredFacts(input, period)
      return {
        period: this.toPeriodView(period),
        rows: this.buildHourlyFromFacts(callFacts),
      }
    }

    const rows = await this.repository.getHourlyRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallback(rows)) {
      const callFacts = await this.repository.getCallFactRows({ clientId: input.clientId, period })
      return {
        period: this.toPeriodView(period),
        rows: this.buildHourlyFromFacts(callFacts),
      }
    }

    return {
      period: this.toPeriodView(period),
      rows: this.buildHourlyFromRows(rows),
    }
  }

  async getAgentRanking(input: CallKpiQueryPeriodInput): Promise<CallKpiAgentRankingResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const callFacts = await this.getFilteredFacts(input, period)
      return {
        period: this.toPeriodView(period),
        rows: this.buildRankingFromFacts(callFacts),
      }
    }

    const rows = await this.repository.getAgentRankingRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallback(rows)) {
      const callFacts = await this.repository.getCallFactRows({ clientId: input.clientId, period })
      return {
        period: this.toPeriodView(period),
        rows: this.buildRankingFromFacts(callFacts),
      }
    }

    return {
      period: this.toPeriodView(period),
      rows: this.buildRankingFromRows(rows),
    }
  }

  async getHourlyComparison(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyComparisonResponse> {
    const period = this.toPeriod(input)

    if (this.hasFactFilters(input)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.getFilteredFacts(input, period),
        this.repository.getTelemarketingBudgetRows({ clientId: input.clientId, period }),
      ])

      return {
        period: this.toPeriodView(period),
        rows: this.buildHourlyComparisonFromFacts(callFacts, telemarketingBudgetRows),
      }
    }

    const rows = await this.repository.getHourlyComparisonRows({
      clientId: input.clientId,
      period,
    })

    if (this.shouldFallback(rows)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.repository.getCallFactRows({ clientId: input.clientId, period }),
        this.repository.getTelemarketingBudgetRows({ clientId: input.clientId, period }),
      ])

      return {
        period: this.toPeriodView(period),
        rows: this.buildHourlyComparisonFromFacts(callFacts, telemarketingBudgetRows),
      }
    }

    return {
      period: this.toPeriodView(period),
      rows: this.buildHourlyComparisonFromRows(rows),
    }
  }

  private buildSummaryFromRows(rows: CallKpiSnapshotRow[]): Omit<CallKpiSummaryResponse, 'period'> {
    const summary = {
      received: { count: 0 },
      lost: { count: 0 },
      totalInbound: { count: 0 },
      telemarketingOpenBudgets: { count: 0 },
      peakHour: { hour: '00', totalInboundCount: 0 },
    }

    for (const row of rows) {
      if (row.metricKey === 'received.count') {
        summary.received.count = this.toCount(row.metricValue)
      } else if (row.metricKey === 'lost.count') {
        summary.lost.count = this.toCount(row.metricValue)
      } else if (row.metricKey === 'total_inbound.count') {
        summary.totalInbound.count = this.toCount(row.metricValue)
      } else if (row.metricKey === 'telemarketing_open_budgets.count') {
        summary.telemarketingOpenBudgets.count = this.toCount(row.metricValue)
      } else if (row.metricKey === 'peak_hour.count') {
        summary.peakHour.totalInboundCount = this.toCount(row.metricValue)
        summary.peakHour.hour = String(row.dimensionsJson?.hour ?? '00')
      }
    }

    return summary
  }

  private buildSummaryFromFacts(
    callFacts: CallFactRecord[],
    telemarketingBudgetRows: TelemarketingBudgetFactRecord[],
  ): Omit<CallKpiSummaryResponse, 'period'> {
    const validCallFacts = this.onlyInboundFacts(callFacts)
    const hourlyRows = this.buildHourlyFromFacts(validCallFacts)
    const peakHour = hourlyRows.reduce(
      (best, row) =>
        row.totalInboundCount > best.totalInboundCount
          ? { hour: row.hour, totalInboundCount: row.totalInboundCount }
          : best,
      { hour: '00', totalInboundCount: 0 },
    )

    return {
      received: { count: validCallFacts.filter((fact) => fact.isReceived).length },
      lost: { count: validCallFacts.filter((fact) => fact.isLost).length },
      totalInbound: { count: validCallFacts.length },
      telemarketingOpenBudgets: {
        count: telemarketingBudgetRows.filter((row) => (row.statusNormalized ?? '').toUpperCase() === 'OPEN').length,
      },
      peakHour,
    }
  }

  private buildHourlyFromRows(rows: CallKpiBreakdownRow[]): CallKpiHourlyRow[] {
    const grouped = this.createHourlyMap<CallKpiHourlyRow>((hour) => ({
      hour,
      receivedCount: 0,
      lostCount: 0,
      totalInboundCount: 0,
    }))

    for (const row of rows) {
      const hour = row.dimensionKey ?? row.dimensionLabel ?? '00'
      const current = grouped.get(hour) ?? {
        hour,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }

      if (row.metricKey === 'received.count') {
        current.receivedCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'lost.count') {
        current.lostCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'total_inbound.count') {
        current.totalInboundCount = this.toCount(row.metricValue)
      }

      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildHourlyFromFacts(callFacts: CallFactRecord[]): CallKpiHourlyRow[] {
    const grouped = this.createHourlyMap<CallKpiHourlyRow>((hour) => ({
      hour,
      receivedCount: 0,
      lostCount: 0,
      totalInboundCount: 0,
    }))

    for (const fact of this.onlyInboundFacts(callFacts)) {
      const hour = this.extractHour(fact.startedAt)
      const current = grouped.get(hour) ?? {
        hour,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }

      current.receivedCount += fact.isReceived ? 1 : 0
      current.lostCount += fact.isLost ? 1 : 0
      current.totalInboundCount += 1
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildRankingFromRows(rows: CallKpiBreakdownRow[]): CallKpiAgentRankingRow[] {
    const grouped = new Map<string, RankingBucket>()

    for (const row of rows) {
      const agentKey = row.dimensionKey ?? 'extension:unknown'
      const payload = (row.payloadJson ?? {}) as Record<string, unknown>
      const current = grouped.get(agentKey) ?? {
        agentType: (payload.agentType as 'EMPLOYEE' | 'EXTENSION' | undefined) ?? 'EXTENSION',
        agentKey,
        agentLabel: row.dimensionLabel ?? agentKey,
        employeeName: (payload.employeeName as string | null | undefined) ?? null,
        extensionNumber: (payload.extensionNumber as string | null | undefined) ?? null,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }

      if (row.metricKey === 'received.count') {
        current.receivedCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'lost.count') {
        current.lostCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'total_inbound.count') {
        current.totalInboundCount = this.toCount(row.metricValue)
      }

      grouped.set(agentKey, current)
    }

    return this.sortRankingRows(
      [...grouped.values()].map((row) => ({
        ...row,
        totalInboundCount:
          row.totalInboundCount === 0 ? row.receivedCount + row.lostCount : row.totalInboundCount,
      })),
    )
  }

  private buildRankingFromFacts(callFacts: CallFactRecord[]): CallKpiAgentRankingRow[] {
    const grouped = new Map<string, RankingBucket>()

    for (const fact of this.onlyInboundFacts(callFacts)) {
      const identity = this.resolveAgentIdentity(fact)

      if (identity === null) {
        continue
      }

      const current = grouped.get(identity.agentKey) ?? identity
      current.receivedCount += fact.isReceived ? 1 : 0
      current.lostCount += fact.isLost ? 1 : 0
      current.totalInboundCount += 1
      grouped.set(identity.agentKey, current)
    }

    return this.sortRankingRows([...grouped.values()])
  }

  private buildHourlyComparisonFromRows(rows: CallKpiBreakdownRow[]): CallKpiHourlyComparisonRow[] {
    const grouped = this.createHourlyMap<CallKpiHourlyComparisonRow>((hour) => ({
      hour,
      receivedCount: 0,
      lostCount: 0,
      telemarketingBudgetCount: 0,
    }))

    for (const row of rows) {
      const hour = row.dimensionKey ?? row.dimensionLabel ?? '00'
      const current = grouped.get(hour) ?? {
        hour,
        receivedCount: 0,
        lostCount: 0,
        telemarketingBudgetCount: 0,
      }

      if (row.metricKey === 'received.count') {
        current.receivedCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'lost.count') {
        current.lostCount = this.toCount(row.metricValue)
      } else if (row.metricKey === 'telemarketing_budget.count') {
        current.telemarketingBudgetCount = this.toCount(row.metricValue)
      }

      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private buildHourlyComparisonFromFacts(
    callFacts: CallFactRecord[],
    telemarketingBudgetRows: TelemarketingBudgetFactRecord[],
  ): CallKpiHourlyComparisonRow[] {
    const grouped = this.createHourlyMap<CallKpiHourlyComparisonRow>((hour) => ({
      hour,
      receivedCount: 0,
      lostCount: 0,
      telemarketingBudgetCount: 0,
    }))

    for (const fact of this.onlyInboundFacts(callFacts)) {
      const hour = this.extractHour(fact.startedAt)
      const current = grouped.get(hour) ?? {
        hour,
        receivedCount: 0,
        lostCount: 0,
        telemarketingBudgetCount: 0,
      }

      current.receivedCount += fact.isReceived ? 1 : 0
      current.lostCount += fact.isLost ? 1 : 0
      grouped.set(hour, current)
    }

    for (const row of telemarketingBudgetRows) {
      const hour = this.extractHour(row.budgetDatetime)
      const current = grouped.get(hour) ?? {
        hour,
        receivedCount: 0,
        lostCount: 0,
        telemarketingBudgetCount: 0,
      }

      current.telemarketingBudgetCount += 1
      grouped.set(hour, current)
    }

    return [...grouped.values()].sort((left, right) => left.hour.localeCompare(right.hour))
  }

  private resolveAgentIdentity(fact: CallFactRecord): RankingBucket | null {
    const extensionNumber = fact.agentExtensionNumber ?? fact.agentResolutionKey

    if (fact.employeeName) {
      const identityKey = fact.extensionUuid ?? fact.agentResolutionKey ?? extensionNumber ?? fact.employeeName

      return {
        agentType: 'EMPLOYEE',
        agentKey: `employee:${identityKey}`,
        agentLabel: fact.employeeName,
        employeeName: fact.employeeName,
        extensionNumber,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }
    }

    if (extensionNumber) {
      return {
        agentType: 'EXTENSION',
        agentKey: `extension:${extensionNumber}`,
        agentLabel: extensionNumber,
        employeeName: null,
        extensionNumber,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }
    }

    return null
  }

  private createHourlyMap<T extends { hour: string }>(factory: (hour: string) => T): Map<string, T> {
    const map = new Map<string, T>()

    for (let hour = 0; hour < 24; hour += 1) {
      const key = String(hour).padStart(2, '0')
      map.set(key, factory(key))
    }

    return map
  }

  private onlyInboundFacts(callFacts: CallFactRecord[]): CallFactRecord[] {
    return callFacts.filter((fact) => fact.isInboundToCompany)
  }

  private async getFilteredFacts(input: CallKpiQueryPeriodInput, period: KpiPeriod): Promise<CallFactRecord[]> {
    const callFacts = await this.repository.getCallFactRows({
      clientId: input.clientId,
      period,
    })

    const sellerId = this.normalizeSellerId(input.sellerId)

    if (sellerId === undefined) {
      return callFacts
    }

    const employee = await this.repository.getEmployeeBySellerId({
      clientId: input.clientId,
      sellerId,
    })

    if (employee === null) {
      return []
    }

    return callFacts
      .filter((fact) => this.matchesSellerFilter(fact, employee))
      .map((fact) => ({
        ...fact,
        employeeName: fact.employeeName ?? employee.name,
        extensionUuid: fact.extensionUuid ?? this.normalizeOptionalText(employee.extensionUuid),
      }))
  }

  private toPeriod(input: CallKpiQueryPeriodInput): KpiPeriod {
    return KpiPeriod.between({
      from: input.from,
      to: input.to,
    })
  }

  private toPeriodView(period: KpiPeriod): CallKpiPeriodView {
    return {
      from: KpiPeriod.formatDateKey(period.from),
      to: KpiPeriod.formatDateKey(period.to),
      key: period.key,
    }
  }

  private shouldFallback(rows: Array<CallKpiSnapshotRow | CallKpiBreakdownRow>): boolean {
    if (rows.length === 0) {
      return true
    }

    return rows.every((row) => this.toCount(row.metricValue) === 0)
  }

  private hasFactFilters(input: CallKpiQueryPeriodInput): boolean {
    return input.sellerId !== undefined
  }

  private matchesSellerFilter(fact: CallFactRecord, employee: CallSellerFilterEmployee): boolean {
    const extensionUuid = this.normalizeOptionalText(employee.extensionUuid)
    const extensionNumber = this.normalizeOptionalText(employee.extensionNumber)

    if (extensionUuid !== null && fact.extensionUuid === extensionUuid) {
      return true
    }

    if (extensionNumber === null) {
      return false
    }

    return fact.agentExtensionNumber === extensionNumber || fact.agentResolutionKey === extensionNumber
  }

  private sortRankingRows(rows: RankingBucket[]): CallKpiAgentRankingRow[] {
    return rows.sort((left, right) => {
      if (left.receivedCount !== right.receivedCount) {
        return right.receivedCount - left.receivedCount
      }

      if (left.totalInboundCount !== right.totalInboundCount) {
        return right.totalInboundCount - left.totalInboundCount
      }

      return left.agentLabel.localeCompare(right.agentLabel)
    })
  }

  private extractHour(value: Date | string): string {
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '00' : String(parsed.getUTCHours()).padStart(2, '0')
    }

    return String(value.getUTCHours()).padStart(2, '0')
  }

  private toCount(value: string | number | bigint): number {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : 0
  }

  private normalizeSellerId(value: CallKpiQueryPeriodInput['sellerId']): number | undefined {
    return this.normalizeOptionalSafeInteger(value, 'sellerId')
  }

  private normalizeOptionalSafeInteger(
    value: string | number | bigint | undefined,
    fieldName: 'sellerId',
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

  private normalizeOptionalText(value: string | null): string | null {
    if (value == null) {
      return null
    }

    const normalized = value.trim()
    return normalized === '' ? null : normalized
  }
}
