import { Prisma } from '@prisma/client'
import { BudgetKpiAvailabilityService } from './budget-kpi-availability.service'
import { KpiPeriod } from '../domain/kpi-period'
import { BudgetNormalizationService } from '../../normalization/application/budget-normalization.service'

export type BudgetFactRecord = {
  id: bigint | number | string
  budgetDate: Date
  budgetDatetime?: Date | string
  sellerId: number | string | bigint
  sellerName: string | null
  statusNormalized: string | null
  channel?: string | null
  valueAmount: string | number | bigint | Prisma.Decimal
}

export type BudgetKpiDefinitionSet = {
  summaryDefinitionId: bigint
  dailyDefinitionId: bigint
  drilldownDefinitionId: bigint
}

export type BudgetKpiSnapshotRow = {
  metricKey: string
  metricValue: string
  dimensionsJson: Record<string, unknown> | null
}

export type BudgetKpiBreakdownRow = {
  bucketDate: Date
  dimensionType: string
  dimensionKey: string | null
  dimensionLabel: string | null
  metricKey: string
  metricValue: string
  payloadJson: Record<string, unknown> | null
  sortOrder: number
}

export type BudgetKpiCalculationRunInput = {
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

export type BudgetKpiCalculationRunUpdate = {
  runId: bigint
  recordsRead: number
  recordsWritten: number
  finishedAt: Date
  errorMessage?: string | null
  status?: string
}

export type BudgetKpiRefreshRepository = {
  ensureDefinitions(): Promise<BudgetKpiDefinitionSet>
  listBudgetFacts(input: { clientId: string; from: Date; to: Date }): Promise<BudgetFactRecord[]>
  createCalculationRun(input: BudgetKpiCalculationRunInput): Promise<{ id: bigint }>
  completeCalculationRun(input: BudgetKpiCalculationRunUpdate): Promise<void>
  failCalculationRun(input: BudgetKpiCalculationRunUpdate): Promise<void>
  persistMaterialization(input: {
    clientId: string
    summaryDefinitionId: bigint
    dailyDefinitionId: bigint
    drilldownDefinitionId: bigint
    period: KpiPeriod
    summaryRows: BudgetKpiSnapshotRow[]
    dailyRows: BudgetKpiBreakdownRow[]
    drilldownRows: BudgetKpiBreakdownRow[]
  }): Promise<{ snapshotsCreated: number; breakdownsCreated: number }>
}

export type BudgetKpiRefreshInput = {
  clientId: string
  from: string | Date
  to: string | Date
}

export type BudgetKpiRefreshResult = {
  clientId: string
  from: string
  to: string
  calculationRunId: string
  recordsRead: number
  snapshotsCreated: number
  breakdownsCreated: number
  availabilityEnabled: boolean
}

export class BudgetKpiRefreshService {
  constructor(
    private readonly repository: BudgetKpiRefreshRepository,
    private readonly availabilityService?: BudgetKpiAvailabilityService,
    private readonly budgetNormalizationService?: BudgetNormalizationService,
  ) {}

  async refresh(input: BudgetKpiRefreshInput): Promise<BudgetKpiRefreshResult> {
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
        family: 'budgets',
        periodKey: period.key,
      },
    })

    try {
      if (!this.budgetNormalizationService) {
        throw new Error('BudgetKpiRefreshService requires BudgetNormalizationService')
      }

      await this.budgetNormalizationService.normalizeClientBudgets(input.clientId)

      const facts = await this.repository.listBudgetFacts({
        clientId: input.clientId,
        from: period.from,
        to: period.to,
      })

      const summaryRows = this.buildSummaryRows(facts)
      const dailyRows = this.buildDailyRows(period, facts)
      const drilldownRows = this.buildDrilldownRows(facts)

      const materialization = await this.repository.persistMaterialization({
        clientId: input.clientId,
        summaryDefinitionId: definitions.summaryDefinitionId,
        dailyDefinitionId: definitions.dailyDefinitionId,
        drilldownDefinitionId: definitions.drilldownDefinitionId,
        period,
        summaryRows,
        dailyRows,
        drilldownRows,
      })

      const availabilityEnabled = await this.markAvailability({
        clientId: input.clientId,
        definitionIds: [
          definitions.summaryDefinitionId,
          definitions.dailyDefinitionId,
          definitions.drilldownDefinitionId,
        ],
        metadataJson: {
          family: 'budgets',
          recordsRead: facts.length,
          periodKey: period.key,
        },
      })

      const snapshotsCreated = materialization.snapshotsCreated
      const breakdownsCreated = materialization.breakdownsCreated
      const recordsWritten = snapshotsCreated + breakdownsCreated
      await this.repository.completeCalculationRun({
        runId: run.id,
        recordsRead: facts.length,
        recordsWritten,
        finishedAt: new Date(),
        status: 'COMPLETED',
      })

      return {
        clientId: input.clientId,
        from: KpiPeriod.formatDateKey(period.from),
        to: KpiPeriod.formatDateKey(period.to),
        calculationRunId: run.id.toString(),
        recordsRead: facts.length,
        snapshotsCreated,
        breakdownsCreated,
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
    return `budgets:${clientId}:${periodKey}:${Date.now()}`
  }

  private async markAvailability(
    input: Parameters<BudgetKpiAvailabilityService['refreshBudgetAvailabilityForDefinitions']>[0],
  ): Promise<boolean> {
    if (this.availabilityService) {
      return this.availabilityService.refreshBudgetAvailabilityForDefinitions(input)
    }

    throw new Error('BudgetKpiRefreshService requires BudgetKpiAvailabilityService')
  }

  private buildSummaryRows(facts: BudgetFactRecord[]): BudgetKpiSnapshotRow[] {
    const totalValue = this.sumValues(facts)
    const openFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'OPEN')
    const wonFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'WON')
    const lostFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'LOST')

    return [
      this.toSnapshotRow('total.count', String(facts.length), 'TOTAL'),
      this.toSnapshotRow('total.value', totalValue, 'TOTAL'),
      this.toSnapshotRow('open.count', String(openFacts.length), 'OPEN'),
      this.toSnapshotRow('open.value', this.sumValues(openFacts), 'OPEN'),
      this.toSnapshotRow('won.count', String(wonFacts.length), 'WON'),
      this.toSnapshotRow('won.value', this.sumValues(wonFacts), 'WON'),
      this.toSnapshotRow('lost.count', String(lostFacts.length), 'LOST'),
      this.toSnapshotRow('lost.value', this.sumValues(lostFacts), 'LOST'),
    ]
  }

  private buildDailyRows(period: KpiPeriod, facts: BudgetFactRecord[]): BudgetKpiBreakdownRow[] {
    const rows: BudgetKpiBreakdownRow[] = []

    for (const bucketDate of period.eachDay()) {
      const dateKey = this.dateKey(bucketDate)
      const grouped = facts.filter((fact) => this.dateKey(fact.budgetDate) === dateKey)

      rows.push(
        this.toBreakdownRow({
          bucketDate,
          dimensionType: 'DAY',
          dimensionKey: dateKey,
          dimensionLabel: dateKey,
          metricKey: 'count',
          metricValue: String(grouped.length),
          payloadJson: {
            bucket: dateKey,
            family: 'budgets',
          },
          sortOrder: 0,
        }),
        this.toBreakdownRow({
          bucketDate,
          dimensionType: 'DAY',
          dimensionKey: dateKey,
          dimensionLabel: dateKey,
          metricKey: 'value',
          metricValue: this.sumValues(grouped),
          payloadJson: {
            bucket: dateKey,
            family: 'budgets',
          },
          sortOrder: 1,
        }),
      )
    }

    return rows
  }

  private buildDrilldownRows(facts: BudgetFactRecord[]): BudgetKpiBreakdownRow[] {
    const groupedFacts = this.groupFactsByKey(facts, (fact) => `${this.parseNumberLike(fact.sellerId)}:${fact.sellerName ?? ''}`)
    const rows: BudgetKpiBreakdownRow[] = []

    for (const [sellerKey, grouped] of groupedFacts) {
      const [sellerId, sellerName] = sellerKey.split(':', 2)
      const bucketDate = grouped[0]?.budgetDate ?? new Date()

      rows.push(
        this.toBreakdownRow({
          bucketDate,
          dimensionType: 'SELLER',
          dimensionKey: sellerId,
          dimensionLabel: sellerName || null,
          metricKey: 'count',
          metricValue: String(grouped.length),
          payloadJson: {
            sellerId,
            sellerName: sellerName || null,
            family: 'budgets',
          },
          sortOrder: 0,
        }),
        this.toBreakdownRow({
          bucketDate,
          dimensionType: 'SELLER',
          dimensionKey: sellerId,
          dimensionLabel: sellerName || null,
          metricKey: 'value',
          metricValue: this.sumValues(grouped),
          payloadJson: {
            sellerId,
            sellerName: sellerName || null,
            family: 'budgets',
          },
          sortOrder: 1,
        }),
      )
    }

    return rows
  }

  private toSnapshotRow(
    metricKey: string,
    metricValue: string,
    status: 'TOTAL' | 'OPEN' | 'WON' | 'LOST',
  ): BudgetKpiSnapshotRow {
    return {
      metricKey,
      metricValue,
      dimensionsJson: {
        status,
      },
    }
  }

  private toBreakdownRow(input: BudgetKpiBreakdownRow): BudgetKpiBreakdownRow {
    return input
  }

  private groupFactsByKey(
    facts: BudgetFactRecord[],
    getKey: (fact: BudgetFactRecord) => string,
  ): Map<string, BudgetFactRecord[]> {
    const grouped = new Map<string, BudgetFactRecord[]>()

    for (const fact of facts) {
      const key = getKey(fact)
      const bucket = grouped.get(key)

      if (bucket) {
        bucket.push(fact)
        continue
      }

      grouped.set(key, [fact])
    }

    return new Map([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)))
  }

  private sumValues(facts: BudgetFactRecord[]): string {
    const total = facts.reduce((accumulator, fact) => {
      return accumulator.add(new Prisma.Decimal(this.parseDecimalLike(fact.valueAmount)))
    }, new Prisma.Decimal(0))

    return total.toFixed(4)
  }

  private normalizeStatus(value: string | null): 'OPEN' | 'WON' | 'LOST' | 'UNKNOWN' {
    const normalized = (value ?? 'UNKNOWN').toUpperCase()

    if (normalized === 'OPEN' || normalized === 'WON' || normalized === 'LOST') {
      return normalized
    }

    return 'UNKNOWN'
  }

  private parseDecimalLike(value: string | number | bigint | Prisma.Decimal): string {
    return value instanceof Prisma.Decimal ? value.toString() : String(value)
  }

  private parseNumberLike(value: number | string | bigint): string {
    return String(value)
  }

  private dateKey(value: Date): string {
    return KpiPeriod.formatDateKey(value)
  }

  private parseDateKey(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part))

    const parsed = new Date(Date.UTC(year, month - 1, day))

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error(`Invalid KPI date key: ${value}`)
    }

    return parsed
  }
}
