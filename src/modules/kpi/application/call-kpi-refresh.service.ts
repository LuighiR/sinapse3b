import { CallKpiAvailabilityService } from './call-kpi-availability.service'
import { KpiPeriod } from '../domain/kpi-period'
import { CallNormalizationService } from '../../normalization/application/call-normalization.service'

export type CallFactRecord = {
  id: bigint | number | string
  startedAt: Date | string
  isInboundToCompany: boolean
  isReceived: boolean
  isLost: boolean
  agentResolutionType: string | null
  agentResolutionKey: string | null
  agentExtensionNumber: string | null
  extensionUuid: string | null
  employeeId?: number | null
  employeeName: string | null
}

export type TelemarketingBudgetFactRecord = {
  budgetDatetime: Date | string
  statusNormalized: string | null
}

export type CallKpiDefinitionSet = {
  summaryDefinitionId: bigint
  hourlyDefinitionId: bigint
  agentRankingDefinitionId: bigint
  hourlyComparisonDefinitionId: bigint
}

export type CallKpiSnapshotRow = {
  metricKey: string
  metricValue: string
  dimensionsJson: Record<string, unknown> | null
}

export type CallKpiBreakdownRow = {
  bucketDate: Date
  dimensionType: string
  dimensionKey: string | null
  dimensionLabel: string | null
  metricKey: string
  metricValue: string
  payloadJson: Record<string, unknown> | null
  sortOrder: number
}

export type CallKpiCalculationRunInput = {
  clientId: string
  definitionId: bigint
  runKey: string
  status: string
  periodType: string
  periodStart: Date
  periodEnd: Date
  recordsRead: number
  recordsWritten: number
  metadataJson: Record<string, unknown> | null
}

export type CallKpiCalculationRunUpdate = {
  runId: bigint
  recordsRead: number
  recordsWritten: number
  finishedAt: Date
  errorMessage?: string | null
  status?: string
}

export type CallKpiRefreshRepository = {
  ensureDefinitions(): Promise<CallKpiDefinitionSet>
  listCallFacts(input: { clientId: string; from: Date; to: Date; branchId?: number }): Promise<CallFactRecord[]>
  listTelemarketingBudgetFacts(input: {
    clientId: string
    from: Date
    to: Date
    branchId?: number
  }): Promise<TelemarketingBudgetFactRecord[]>
  createCalculationRun(input: CallKpiCalculationRunInput): Promise<{ id: bigint }>
  completeCalculationRun(input: CallKpiCalculationRunUpdate): Promise<void>
  failCalculationRun(input: CallKpiCalculationRunUpdate): Promise<void>
  persistMaterialization(input: {
    clientId: string
    summaryDefinitionId: bigint
    hourlyDefinitionId: bigint
    agentRankingDefinitionId: bigint
    hourlyComparisonDefinitionId: bigint
    period: KpiPeriod
    summaryRows: CallKpiSnapshotRow[]
    hourlyRows: CallKpiBreakdownRow[]
    rankingRows: CallKpiBreakdownRow[]
    comparisonRows: CallKpiBreakdownRow[]
  }): Promise<{ snapshotsCreated: number; breakdownsCreated: number }>
}

export type CallKpiRefreshInput = {
  clientId: string
  from: string | Date
  to: string | Date
}

export type CallKpiRefreshResult = {
  clientId: string
  from: string
  to: string
  calculationRunId: string
  recordsRead: number
  snapshotsCreated: number
  breakdownsCreated: number
  availabilityEnabled: boolean
}

type AgentBucket = {
  dimensionKey: string
  dimensionLabel: string
  payloadJson: Record<string, unknown>
  receivedCount: number
  lostCount: number
  totalInboundCount: number
}

export class CallKpiRefreshService {
  constructor(
    private readonly repository: CallKpiRefreshRepository,
    private readonly availabilityService?: CallKpiAvailabilityService,
    private readonly callNormalizationService?: CallNormalizationService,
  ) {}

  async refresh(input: CallKpiRefreshInput): Promise<CallKpiRefreshResult> {
    const period = KpiPeriod.between({ from: input.from, to: input.to })
    const definitions = await this.repository.ensureDefinitions()
    const run = await this.repository.createCalculationRun({
      clientId: input.clientId,
      definitionId: definitions.summaryDefinitionId,
      runKey: this.buildRunKey(input.clientId, period.key),
      status: 'RUNNING',
      periodType: KpiPeriod.periodType,
      periodStart: period.from,
      periodEnd: period.to,
      recordsRead: 0,
      recordsWritten: 0,
      metadataJson: {
        family: 'calls',
        periodKey: period.key,
      },
    })

    try {
      if (!this.callNormalizationService) {
        throw new Error('CallKpiRefreshService requires CallNormalizationService')
      }

      await this.callNormalizationService.normalizeClientCalls(input.clientId)

      const callFacts = await this.repository.listCallFacts({
        clientId: input.clientId,
        from: period.from,
        to: period.to,
      })
      const telemarketingBudgetFacts = await this.repository.listTelemarketingBudgetFacts({
        clientId: input.clientId,
        from: period.from,
        to: period.to,
      })

      const summaryRows = this.buildSummaryRows(callFacts, telemarketingBudgetFacts)
      const hourlyRows = this.buildHourlyRows(period, callFacts)
      const rankingRows = this.buildRankingRows(period, callFacts)
      const comparisonRows = this.buildComparisonRows(period, callFacts, telemarketingBudgetFacts)

      const materialization = await this.repository.persistMaterialization({
        clientId: input.clientId,
        summaryDefinitionId: definitions.summaryDefinitionId,
        hourlyDefinitionId: definitions.hourlyDefinitionId,
        agentRankingDefinitionId: definitions.agentRankingDefinitionId,
        hourlyComparisonDefinitionId: definitions.hourlyComparisonDefinitionId,
        period,
        summaryRows,
        hourlyRows,
        rankingRows,
        comparisonRows,
      })

      const availabilityEnabled = await this.markAvailability({
        clientId: input.clientId,
        definitionIds: [
          definitions.summaryDefinitionId,
          definitions.hourlyDefinitionId,
          definitions.agentRankingDefinitionId,
          definitions.hourlyComparisonDefinitionId,
        ],
        metadataJson: {
          family: 'calls',
          recordsRead: callFacts.length,
          periodKey: period.key,
        },
      })

      const recordsWritten = materialization.snapshotsCreated + materialization.breakdownsCreated
      await this.repository.completeCalculationRun({
        runId: run.id,
        recordsRead: callFacts.length,
        recordsWritten,
        finishedAt: new Date(),
        status: 'COMPLETED',
      })

      return {
        clientId: input.clientId,
        from: KpiPeriod.formatDateKey(period.from),
        to: KpiPeriod.formatDateKey(period.to),
        calculationRunId: run.id.toString(),
        recordsRead: callFacts.length,
        snapshotsCreated: materialization.snapshotsCreated,
        breakdownsCreated: materialization.breakdownsCreated,
        availabilityEnabled,
      }
    } catch (error) {
      await this.repository.failCalculationRun({
        runId: run.id,
        recordsRead: 0,
        recordsWritten: 0,
        finishedAt: new Date(),
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  private buildRunKey(clientId: string, periodKey: string): string {
    return `calls:${clientId}:${periodKey}:${Date.now()}`
  }

  private async markAvailability(
    input: Parameters<CallKpiAvailabilityService['refreshCallAvailabilityForDefinitions']>[0],
  ): Promise<boolean> {
    if (this.availabilityService) {
      return this.availabilityService.refreshCallAvailabilityForDefinitions(input)
    }

    throw new Error('CallKpiRefreshService requires CallKpiAvailabilityService')
  }

  private buildSummaryRows(
    callFacts: CallFactRecord[],
    telemarketingBudgetFacts: TelemarketingBudgetFactRecord[],
  ): CallKpiSnapshotRow[] {
    const validCallFacts = this.onlyInboundFacts(callFacts)
    const receivedCount = validCallFacts.filter((fact) => fact.isReceived).length
    const lostCount = validCallFacts.filter((fact) => fact.isLost).length
    const totalInboundCount = validCallFacts.length
    const telemarketingOpenBudgetsCount = telemarketingBudgetFacts.filter(
      (fact) => (fact.statusNormalized ?? '').toUpperCase() === 'OPEN',
    ).length
    const peakHour = this.resolvePeakHour(validCallFacts)

    return [
      this.toSnapshotRow('received.count', String(receivedCount), { family: 'calls' }),
      this.toSnapshotRow('lost.count', String(lostCount), { family: 'calls' }),
      this.toSnapshotRow('total_inbound.count', String(totalInboundCount), { family: 'calls' }),
      this.toSnapshotRow('telemarketing_open_budgets.count', String(telemarketingOpenBudgetsCount), {
        family: 'calls',
      }),
      this.toSnapshotRow('peak_hour.count', String(peakHour.count), {
        family: 'calls',
        hour: peakHour.hour,
      }),
    ]
  }

  private buildHourlyRows(period: KpiPeriod, callFacts: CallFactRecord[]): CallKpiBreakdownRow[] {
    const validCallFacts = this.onlyInboundFacts(callFacts)
    const rows: CallKpiBreakdownRow[] = []

    for (let hour = 0; hour < 24; hour += 1) {
      const hourKey = this.toHourKey(hour)
      const grouped = validCallFacts.filter((fact) => this.extractHour(fact.startedAt) === hourKey)

      rows.push(
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'received.count',
          metricValue: String(grouped.filter((fact) => fact.isReceived).length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 0,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'lost.count',
          metricValue: String(grouped.filter((fact) => fact.isLost).length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 1,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'total_inbound.count',
          metricValue: String(grouped.length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 2,
        }),
      )
    }

    return rows
  }

  private buildRankingRows(period: KpiPeriod, callFacts: CallFactRecord[]): CallKpiBreakdownRow[] {
    const grouped = this.groupFactsByAgent(this.onlyInboundFacts(callFacts))
    const rows: CallKpiBreakdownRow[] = []

    for (const bucket of grouped.values()) {
      rows.push(
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'AGENT',
          dimensionKey: bucket.dimensionKey,
          dimensionLabel: bucket.dimensionLabel,
          metricKey: 'received.count',
          metricValue: String(bucket.receivedCount),
          payloadJson: bucket.payloadJson,
          sortOrder: 0,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'AGENT',
          dimensionKey: bucket.dimensionKey,
          dimensionLabel: bucket.dimensionLabel,
          metricKey: 'lost.count',
          metricValue: String(bucket.lostCount),
          payloadJson: bucket.payloadJson,
          sortOrder: 1,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'AGENT',
          dimensionKey: bucket.dimensionKey,
          dimensionLabel: bucket.dimensionLabel,
          metricKey: 'total_inbound.count',
          metricValue: String(bucket.totalInboundCount),
          payloadJson: bucket.payloadJson,
          sortOrder: 2,
        }),
      )
    }

    return rows
  }

  private buildComparisonRows(
    period: KpiPeriod,
    callFacts: CallFactRecord[],
    telemarketingBudgetFacts: TelemarketingBudgetFactRecord[],
  ): CallKpiBreakdownRow[] {
    const validCallFacts = this.onlyInboundFacts(callFacts)
    const rows: CallKpiBreakdownRow[] = []

    for (let hour = 0; hour < 24; hour += 1) {
      const hourKey = this.toHourKey(hour)
      const hourlyCallFacts = validCallFacts.filter((fact) => this.extractHour(fact.startedAt) === hourKey)
      const hourlyBudgets = telemarketingBudgetFacts.filter(
        (fact) => this.extractHour(fact.budgetDatetime) === hourKey,
      )

      rows.push(
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'received.count',
          metricValue: String(hourlyCallFacts.filter((fact) => fact.isReceived).length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 0,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'lost.count',
          metricValue: String(hourlyCallFacts.filter((fact) => fact.isLost).length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 1,
        }),
        this.toBreakdownRow({
          bucketDate: period.from,
          dimensionType: 'HOUR',
          dimensionKey: hourKey,
          dimensionLabel: hourKey,
          metricKey: 'telemarketing_budget.count',
          metricValue: String(hourlyBudgets.length),
          payloadJson: { hour: hourKey, family: 'calls' },
          sortOrder: 2,
        }),
      )
    }

    return rows
  }

  private groupFactsByAgent(callFacts: CallFactRecord[]): Map<string, AgentBucket> {
    const grouped = new Map<string, AgentBucket>()

    for (const fact of callFacts) {
      const identity = this.resolveAgentIdentity(fact)

      if (identity === null) {
        continue
      }

      const current = grouped.get(identity.dimensionKey) ?? {
        dimensionKey: identity.dimensionKey,
        dimensionLabel: identity.dimensionLabel,
        payloadJson: identity.payloadJson,
        receivedCount: 0,
        lostCount: 0,
        totalInboundCount: 0,
      }

      current.receivedCount += fact.isReceived ? 1 : 0
      current.lostCount += fact.isLost ? 1 : 0
      current.totalInboundCount += 1
      grouped.set(identity.dimensionKey, current)
    }

    return new Map([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)))
  }

  private resolvePeakHour(callFacts: CallFactRecord[]): { hour: string; count: number } {
    const counts = new Map<string, number>()

    for (let hour = 0; hour < 24; hour += 1) {
      counts.set(this.toHourKey(hour), 0)
    }

    for (const fact of callFacts) {
      const hour = this.extractHour(fact.startedAt)
      counts.set(hour, (counts.get(hour) ?? 0) + 1)
    }

    let bestHour = '00'
    let bestCount = 0

    for (const [hour, count] of counts) {
      if (count > bestCount) {
        bestHour = hour
        bestCount = count
      }
    }

    return { hour: bestHour, count: bestCount }
  }

  private resolveAgentIdentity(
    fact: CallFactRecord,
  ): { dimensionKey: string; dimensionLabel: string; payloadJson: Record<string, unknown> } | null {
    const extensionNumber = fact.agentExtensionNumber ?? fact.agentResolutionKey

    if (fact.employeeName) {
      const employeeKey =
        fact.extensionUuid ?? fact.agentResolutionKey ?? extensionNumber ?? fact.employeeName

      return {
        dimensionKey: `employee:${employeeKey}`,
        dimensionLabel: fact.employeeName,
        payloadJson: {
          agentType: 'EMPLOYEE',
          employeeName: fact.employeeName,
          extensionNumber,
          extensionUuid: fact.extensionUuid,
          fallbackDestinationNumber: fact.agentExtensionNumber,
        },
      }
    }

    if (extensionNumber) {
      return {
        dimensionKey: `extension:${extensionNumber}`,
        dimensionLabel: extensionNumber,
        payloadJson: {
          agentType: 'EXTENSION',
          employeeName: null,
          extensionNumber,
          extensionUuid: fact.extensionUuid,
          fallbackDestinationNumber: fact.agentExtensionNumber,
        },
      }
    }

    return null
  }

  private onlyInboundFacts(callFacts: CallFactRecord[]): CallFactRecord[] {
    return callFacts.filter((fact) => fact.isInboundToCompany)
  }

  private toSnapshotRow(
    metricKey: string,
    metricValue: string,
    dimensionsJson: Record<string, unknown>,
  ): CallKpiSnapshotRow {
    return {
      metricKey,
      metricValue,
      dimensionsJson,
    }
  }

  private toBreakdownRow(input: CallKpiBreakdownRow): CallKpiBreakdownRow {
    return input
  }

  private toHourKey(hour: number): string {
    return String(hour).padStart(2, '0')
  }

  private extractHour(value: Date | string): string {
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '00' : this.toHourKey(parsed.getUTCHours())
    }

    return this.toHourKey(value.getUTCHours())
  }
}
