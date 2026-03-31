import { Prisma } from '@prisma/client'
import { SaleNormalizationService } from '../../normalization/application/sale-normalization.service'
import { KpiPeriod } from '../domain/kpi-period'
import { SaleKpiAvailabilityService } from './sale-kpi-availability.service'

export type SaleFactRecord = {
  id: bigint | number | string
  saleDate: Date
  saleDatetime?: Date | string
  sellerId: number | string | bigint
  sellerName: string | null
  statusNormalized: string | null
  channel?: string | null
  hasLinkedBudget?: boolean
  valueAmount: string | number | bigint | Prisma.Decimal
}

export type SaleKpiDefinitionSet = {
  summaryDefinitionId: bigint
  dailyDefinitionId: bigint
}

export type SaleKpiSnapshotRow = {
  metricKey: string
  metricValue: string
  dimensionsJson: Record<string, unknown> | null
}

export type SaleKpiBreakdownRow = {
  bucketDate: Date
  dimensionType: string
  dimensionKey: string | null
  dimensionLabel: string | null
  metricKey: string
  metricValue: string
  payloadJson: Record<string, unknown> | null
  sortOrder: number
}

export type SaleKpiCalculationRunInput = {
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

export type SaleKpiCalculationRunUpdate = {
  runId: bigint
  recordsRead: number
  recordsWritten: number
  finishedAt: Date
  errorMessage?: string | null
  status?: string
}

export type SaleKpiRefreshRepository = {
  ensureDefinitions(): Promise<SaleKpiDefinitionSet>
  listSaleFacts(input: { clientId: string; from: Date; to: Date }): Promise<SaleFactRecord[]>
  createCalculationRun(input: SaleKpiCalculationRunInput): Promise<{ id: bigint }>
  completeCalculationRun(input: SaleKpiCalculationRunUpdate): Promise<void>
  failCalculationRun(input: SaleKpiCalculationRunUpdate): Promise<void>
  persistMaterialization(input: {
    clientId: string
    summaryDefinitionId: bigint
    dailyDefinitionId: bigint
    period: KpiPeriod
    summaryRows: SaleKpiSnapshotRow[]
    dailyRows: SaleKpiBreakdownRow[]
  }): Promise<{ snapshotsCreated: number; breakdownsCreated: number }>
}

export type SaleKpiRefreshInput = {
  clientId: string
  from: string | Date
  to: string | Date
}

export type SaleKpiRefreshResult = {
  clientId: string
  from: string
  to: string
  calculationRunId: string
  recordsRead: number
  snapshotsCreated: number
  breakdownsCreated: number
  availabilityEnabled: boolean
}

export class SaleKpiRefreshService {
  constructor(
    private readonly repository: SaleKpiRefreshRepository,
    private readonly availabilityService?: SaleKpiAvailabilityService,
    private readonly saleNormalizationService?: SaleNormalizationService,
  ) {}

  async refresh(input: SaleKpiRefreshInput): Promise<SaleKpiRefreshResult> {
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
        family: 'sales',
        periodKey: period.key,
      },
    })

    try {
      if (!this.saleNormalizationService) {
        throw new Error('SaleKpiRefreshService requires SaleNormalizationService')
      }

      await this.saleNormalizationService.normalizeClientSales(input.clientId)

      const facts = await this.repository.listSaleFacts({
        clientId: input.clientId,
        from: period.from,
        to: period.to,
      })

      const summaryRows = this.buildSummaryRows(period, facts)
      const dailyRows = this.buildDailyRows(period, facts)

      const materialization = await this.repository.persistMaterialization({
        clientId: input.clientId,
        summaryDefinitionId: definitions.summaryDefinitionId,
        dailyDefinitionId: definitions.dailyDefinitionId,
        period,
        summaryRows,
        dailyRows,
      })

      const availabilityEnabled = await this.markAvailability({
        clientId: input.clientId,
        definitionIds: [definitions.summaryDefinitionId, definitions.dailyDefinitionId],
        metadataJson: {
          family: 'sales',
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
    return `sales:${clientId}:${periodKey}:${Date.now()}`
  }

  private async markAvailability(
    input: Parameters<SaleKpiAvailabilityService['refreshSaleAvailabilityForDefinitions']>[0],
  ): Promise<boolean> {
    if (this.availabilityService) {
      return this.availabilityService.refreshSaleAvailabilityForDefinitions(input)
    }

    throw new Error('SaleKpiRefreshService requires SaleKpiAvailabilityService')
  }

  private buildSummaryRows(period: KpiPeriod, facts: SaleFactRecord[]): SaleKpiSnapshotRow[] {
    const activeFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'VALID')
    const canceledFacts = facts.filter((fact) => this.normalizeStatus(fact.statusNormalized) === 'CANCELED')

    return [
      this.toSnapshotRow('total.count', String(facts.length), 'TOTAL'),
      this.toSnapshotRow('total.value', this.sumValues(facts), 'TOTAL'),
      this.toSnapshotRow('active.count', String(activeFacts.length), 'ACTIVE'),
      this.toSnapshotRow('active.value', this.sumValues(activeFacts), 'ACTIVE'),
      this.toSnapshotRow('canceled.count', String(canceledFacts.length), 'CANCELED'),
      this.toSnapshotRow('canceled.value', this.sumValues(canceledFacts), 'CANCELED'),
      this.toSnapshotRow('average_daily.count', this.averageCountPerDay(period, facts), 'TOTAL'),
      this.toSnapshotRow('average_daily.value', this.averageValuePerDay(period, facts), 'TOTAL'),
      this.toSnapshotRow('average_ticket.value', this.averageTicket(facts), 'TOTAL'),
    ]
  }

  private buildDailyRows(period: KpiPeriod, facts: SaleFactRecord[]): SaleKpiBreakdownRow[] {
    const rows: SaleKpiBreakdownRow[] = []

    for (const bucketDate of period.eachDay()) {
      const dateKey = KpiPeriod.formatDateKey(bucketDate)
      const grouped = facts.filter((fact) => KpiPeriod.formatDateKey(fact.saleDate) === dateKey)

      rows.push(
        {
          bucketDate,
          dimensionType: 'DAY',
          dimensionKey: dateKey,
          dimensionLabel: dateKey,
          metricKey: 'count',
          metricValue: String(grouped.length),
          payloadJson: {
            bucket: dateKey,
            family: 'sales',
          },
          sortOrder: 0,
        },
        {
          bucketDate,
          dimensionType: 'DAY',
          dimensionKey: dateKey,
          dimensionLabel: dateKey,
          metricKey: 'value',
          metricValue: this.sumValues(grouped),
          payloadJson: {
            bucket: dateKey,
            family: 'sales',
          },
          sortOrder: 1,
        },
      )
    }

    return rows
  }

  private toSnapshotRow(
    metricKey: string,
    metricValue: string,
    status: 'TOTAL' | 'ACTIVE' | 'CANCELED',
  ): SaleKpiSnapshotRow {
    return {
      metricKey,
      metricValue,
      dimensionsJson: {
        status,
      },
    }
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

  private sumValues(facts: SaleFactRecord[]): string {
    const total = facts.reduce((accumulator, fact) => {
      return accumulator.add(new Prisma.Decimal(this.parseDecimalLike(fact.valueAmount)))
    }, new Prisma.Decimal(0))

    return total.toFixed(4)
  }

  private normalizeStatus(value: string | null): 'VALID' | 'CANCELED' | 'UNKNOWN' {
    const normalized = (value ?? 'UNKNOWN').toUpperCase()

    if (normalized === 'VALID' || normalized === 'CANCELED') {
      return normalized
    }

    return 'UNKNOWN'
  }

  private parseDecimalLike(value: string | number | bigint | Prisma.Decimal): string {
    return value instanceof Prisma.Decimal ? value.toString() : String(value)
  }
}
