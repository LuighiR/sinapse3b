import { Injectable } from '@nestjs/common'
import { KpiPeriod } from '../domain/kpi-period'
import { BranchScopeService } from '../../companies/application/branch-scope.service'
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
  extensionUuid?: string
  extensionNumber?: string
  employeeId?: number
  branchId?: number
  registeredEmployeesOnly?: boolean
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
  getCallFactRows(input: { clientId: string; period: KpiPeriod; branchId?: number }): Promise<CallFactRecord[]>
  getTelemarketingBudgetRows(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
  }): Promise<TelemarketingBudgetFactRecord[]>
  getDrilldownPage(input: CallKpiDrilldownRepositoryInput): Promise<CallKpiDrilldownPage>
  getFilterOptions(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
  }): Promise<CallKpiFilterOptionsResult>
}

export type CallOutcome = 'ANSWERED' | 'UNANSWERED' | 'UNCLASSIFIED'

export type CallKpiDrilldownInput = CallKpiQueryPeriodInput & {
  status?: string
  direction?: string
  callerNumber?: string
  destinationNumber?: string
  durationMin?: number
  durationMax?: number
  outcome?: CallOutcome
  page: number
  pageSize: number
}

export type CallKpiDrilldownFilters = {
  branchId?: number
  employeeId?: number
  extensionUuid?: string
  extensionNumber?: string
  status?: string
  direction?: string
  callerNumber?: string
  destinationNumber?: string
  durationMin?: number
  durationMax?: number
  outcome?: CallOutcome
}

export type CallKpiDrilldownRow = {
  id: string
  startedAt: string
  endedAt: string | null
  durationSeconds: string
  direction: string | null
  status: string | null
  outcome: CallOutcome
  callerNumber: string | null
  destinationNumber: string | null
  extensionUuid: string | null
  agentExtensionNumber: string | null
  isInboundToCompany: boolean
  isReceived: boolean
  isLost: boolean
  branchId: number | null
  branchName: string | null
  employeeId: number | null
  employeeName: string | null
}

export type CallKpiDrilldownPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CallKpiDrilldownResponse = {
  period: CallKpiPeriodView
  filters: CallKpiDrilldownFilters
  pagination: CallKpiDrilldownPagination
  rows: CallKpiDrilldownRow[]
}

export type CallKpiFilterOptionsInput = {
  clientId: string
  from: string | Date
  to: string | Date
  branchId?: number
}

export type CallKpiFilterOptionsResponse = {
  period: CallKpiPeriodView
  filters: { branchId?: number }
  statuses: string[]
  directions: string[]
}

export type CallKpiDrilldownFactRow = {
  id: bigint | number | string
  startedAt: Date | string
  endedAt: Date | string | null
  durationSeconds: string | number
  direction: string | null
  status: string | null
  callerNumber: string | null
  destinationNumber: string | null
  extensionUuid: string | null
  agentExtensionNumber: string | null
  isInboundToCompany: boolean
  isReceived: boolean
  isLost: boolean
  branchId: number | null
  branchName: string | null
  employeeId: number | null
  employeeName: string | null
}

export type CallKpiDrilldownRepositoryInput = {
  clientId: string
  period: KpiPeriod
  branchId?: number
  employeeId?: number
  extensionUuid?: string
  extensionNumber?: string
  status?: string
  direction?: string
  callerNumber?: string
  destinationNumber?: string
  durationMin?: number
  durationMax?: number
  outcome?: CallOutcome
  page: number
  pageSize: number
}

export type CallKpiDrilldownPage = {
  total: number
  rows: CallKpiDrilldownFactRow[]
}

export type CallKpiFilterOptionsResult = {
  statuses: string[]
  directions: string[]
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
  constructor(
    private readonly repository: CallKpiQueryRepository,
    private readonly branchScopeService?: BranchScopeService,
  ) {}

  async getSummary(input: CallKpiQueryPeriodInput): Promise<CallKpiSummaryResponse> {
    const period = this.toPeriod(input)
    await this.assertBranchScope(input)

    if (this.hasFactFilters(input)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.getPeriodFacts(input, period),
        this.repository.getTelemarketingBudgetRows({
          clientId: input.clientId,
          period,
          branchId: input.branchId,
        }),
      ])
      const agentFacts = this.filterFactsByAgent(callFacts, input)

      return {
        period: this.toPeriodView(period),
        ...this.buildSummaryFromFacts(callFacts, agentFacts, telemarketingBudgetRows),
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
        ...this.buildSummaryFromFacts(callFacts, callFacts, telemarketingBudgetRows),
      }
    }

    return {
      period: this.toPeriodView(period),
      ...this.buildSummaryFromRows(rows),
    }
  }

  async getHourly(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyResponse> {
    const period = this.toPeriod(input)
    await this.assertBranchScope(input)

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
    await this.assertBranchScope(input)

    if (this.hasFactFilters(input)) {
      const callFacts = await this.getFilteredFacts(input, period)
      return {
        period: this.toPeriodView(period),
        rows: this.filterRegisteredEmployeeRankingRows(this.buildRankingFromFacts(callFacts), input),
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
        rows: this.filterRegisteredEmployeeRankingRows(this.buildRankingFromFacts(callFacts), input),
      }
    }

    return {
      period: this.toPeriodView(period),
      rows: this.filterRegisteredEmployeeRankingRows(this.buildRankingFromRows(rows), input),
    }
  }

  async getHourlyComparison(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyComparisonResponse> {
    const period = this.toPeriod(input)
    await this.assertBranchScope(input)

    if (this.hasFactFilters(input)) {
      const [callFacts, telemarketingBudgetRows] = await Promise.all([
        this.getFilteredFacts(input, period),
        this.repository.getTelemarketingBudgetRows({
          clientId: input.clientId,
          period,
          branchId: input.branchId,
        }),
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

  async getDrilldown(input: CallKpiDrilldownInput): Promise<CallKpiDrilldownResponse> {
    const period = this.toPeriod(input)
    await this.assertBranchScope(input)

    const page = await this.repository.getDrilldownPage({
      clientId: input.clientId,
      period,
      branchId: input.branchId,
      employeeId: input.employeeId,
      extensionUuid: input.extensionUuid,
      extensionNumber: input.extensionNumber,
      status: input.status,
      direction: input.direction,
      callerNumber: input.callerNumber,
      destinationNumber: input.destinationNumber,
      durationMin: input.durationMin,
      durationMax: input.durationMax,
      outcome: input.outcome,
      page: input.page,
      pageSize: input.pageSize,
    })

    return {
      period: this.toPeriodView(period),
      filters: this.buildDrilldownFilters(input),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: page.total,
        totalPages: page.total === 0 ? 0 : Math.ceil(page.total / input.pageSize),
      },
      rows: page.rows.map((row) => this.toDrilldownRow(row)),
    }
  }

  async getFilterOptions(input: CallKpiFilterOptionsInput): Promise<CallKpiFilterOptionsResponse> {
    const period = this.toPeriod(input)
    await this.assertBranchScope(input)

    const options = await this.repository.getFilterOptions({
      clientId: input.clientId,
      period,
      branchId: input.branchId,
    })

    return {
      period: this.toPeriodView(period),
      filters: input.branchId !== undefined ? { branchId: input.branchId } : {},
      statuses: options.statuses,
      directions: options.directions,
    }
  }

  private buildDrilldownFilters(input: CallKpiDrilldownInput): CallKpiDrilldownFilters {
    const filters: CallKpiDrilldownFilters = {}

    if (input.branchId !== undefined) {
      filters.branchId = input.branchId
    }
    if (input.employeeId !== undefined) {
      filters.employeeId = input.employeeId
    }
    if (input.extensionUuid !== undefined) {
      filters.extensionUuid = input.extensionUuid
    }
    if (input.extensionNumber !== undefined) {
      filters.extensionNumber = input.extensionNumber
    }
    if (input.status !== undefined) {
      filters.status = input.status
    }
    if (input.direction !== undefined) {
      filters.direction = input.direction
    }
    if (input.callerNumber !== undefined) {
      filters.callerNumber = input.callerNumber
    }
    if (input.destinationNumber !== undefined) {
      filters.destinationNumber = input.destinationNumber
    }
    if (input.durationMin !== undefined) {
      filters.durationMin = input.durationMin
    }
    if (input.durationMax !== undefined) {
      filters.durationMax = input.durationMax
    }
    if (input.outcome !== undefined) {
      filters.outcome = input.outcome
    }

    return filters
  }

  private toDrilldownRow(row: CallKpiDrilldownFactRow): CallKpiDrilldownRow {
    return {
      id: String(row.id),
      startedAt: this.toIsoString(row.startedAt),
      endedAt: row.endedAt == null ? null : this.toIsoString(row.endedAt),
      durationSeconds: String(row.durationSeconds),
      direction: row.direction,
      status: row.status,
      outcome: this.resolveOutcome(row),
      callerNumber: row.callerNumber,
      destinationNumber: row.destinationNumber,
      extensionUuid: row.extensionUuid,
      agentExtensionNumber: row.agentExtensionNumber,
      isInboundToCompany: row.isInboundToCompany,
      isReceived: row.isReceived,
      isLost: row.isLost,
      branchId: row.branchId,
      branchName: row.branchName,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
    }
  }

  private resolveOutcome(row: Pick<CallKpiDrilldownFactRow, 'isReceived' | 'isLost'>): CallOutcome {
    if (row.isReceived) {
      return 'ANSWERED'
    }

    if (row.isLost) {
      return 'UNANSWERED'
    }

    return 'UNCLASSIFIED'
  }

  private toIsoString(value: Date | string): string {
    if (typeof value === 'string') {
      return value
    }

    return value.toISOString()
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
    allCallFacts: CallFactRecord[],
    agentCallFacts: CallFactRecord[],
    telemarketingBudgetRows: TelemarketingBudgetFactRecord[],
  ): Omit<CallKpiSummaryResponse, 'period'> {
    const totalInboundFacts = this.onlyInboundFacts(allCallFacts)
    const agentInboundFacts = this.onlyInboundFacts(agentCallFacts)
    const hourlyRows = this.buildHourlyFromFacts(totalInboundFacts)
    const peakHour = hourlyRows.reduce(
      (best, row) =>
        row.totalInboundCount > best.totalInboundCount
          ? { hour: row.hour, totalInboundCount: row.totalInboundCount }
          : best,
      { hour: '00', totalInboundCount: 0 },
    )

    return {
      received: { count: agentInboundFacts.filter((fact) => fact.isReceived).length },
      lost: { count: agentInboundFacts.filter((fact) => fact.isLost).length },
      totalInbound: { count: totalInboundFacts.length },
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

  private filterRegisteredEmployeeRankingRows(
    rows: CallKpiAgentRankingRow[],
    input: Pick<CallKpiQueryPeriodInput, 'registeredEmployeesOnly'>,
  ): CallKpiAgentRankingRow[] {
    if (input.registeredEmployeesOnly !== true) {
      return rows
    }

    return rows.filter((row) => row.agentType === 'EMPLOYEE')
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

  private async getPeriodFacts(input: CallKpiQueryPeriodInput, period: KpiPeriod): Promise<CallFactRecord[]> {
    return this.repository.getCallFactRows({
      clientId: input.clientId,
      period,
      branchId: input.branchId,
    })
  }

  private async getFilteredFacts(input: CallKpiQueryPeriodInput, period: KpiPeriod): Promise<CallFactRecord[]> {
    const callFacts = await this.getPeriodFacts(input, period)
    return this.filterFactsByAgent(callFacts, input)
  }

  private filterFactsByAgent(callFacts: CallFactRecord[], input: CallKpiQueryPeriodInput): CallFactRecord[] {
    const extensionUuid = this.normalizeOptionalText(input.extensionUuid)
    const extensionNumber = this.normalizeOptionalText(input.extensionNumber)
    const employeeId = input.employeeId

    if (extensionUuid === null && extensionNumber === null && employeeId === undefined) {
      return callFacts
    }

    return callFacts
      .filter((fact) => this.matchesCallFilter(fact, { extensionUuid, extensionNumber, employeeId }))
      .map((fact) => ({
        ...fact,
        extensionUuid:
          extensionUuid !== null && fact.extensionUuid === null && this.matchesExtensionNumber(fact, extensionNumber)
            ? extensionUuid
            : fact.extensionUuid,
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
    return (
      input.branchId !== undefined ||
      input.extensionUuid !== undefined ||
      input.extensionNumber !== undefined ||
      input.employeeId !== undefined
    )
  }

  private matchesCallFilter(
    fact: CallFactRecord,
    filter: { extensionUuid: string | null; extensionNumber: string | null; employeeId?: number },
  ): boolean {
    if (filter.employeeId !== undefined) {
      return fact.employeeId === filter.employeeId
    }

    return this.matchesExtensionUuid(fact, filter.extensionUuid) || this.matchesExtensionNumber(fact, filter.extensionNumber)
  }

  private matchesExtensionUuid(fact: CallFactRecord, extensionUuid: string | null): boolean {
    return extensionUuid !== null && fact.extensionUuid === extensionUuid
  }

  private matchesExtensionNumber(fact: CallFactRecord, extensionNumber: string | null): boolean {
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

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value == null) {
      return null
    }

    const normalized = value.trim()
    return normalized === '' ? null : normalized
  }

  private async assertBranchScope(input: CallKpiQueryPeriodInput): Promise<void> {
    if (!this.branchScopeService) {
      return
    }

    await this.branchScopeService.assertBranchScope(input.clientId, input.branchId)
  }
}
