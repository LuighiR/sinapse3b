import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { KpiPeriod } from '../domain/kpi-period'
import {
  CallKpiAvailabilityRepository,
  CallKpiAvailabilityUpdate,
} from '../application/call-kpi-availability.service'
import {
  CallFactRecord,
  CallKpiBreakdownRow,
  CallKpiCalculationRunInput,
  CallKpiCalculationRunUpdate,
  CallKpiDefinitionSet,
  CallKpiRefreshRepository,
  CallKpiSnapshotRow,
  TelemarketingBudgetFactRecord,
} from '../application/call-kpi-refresh.service'
import { CallKpiQueryRepository } from '../application/call-kpi-query.service'

type EmployeeLookupRow = {
  name: string
  extensionUuid: string
  extensionNumber: string
}

type CallFactEmployeeCandidate = Omit<CallFactRecord, 'employeeName'>

@Injectable()
export class PrismaCallKpiRepository
  implements CallKpiRefreshRepository, CallKpiAvailabilityRepository, CallKpiQueryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async hasUsableCallFacts(clientId: string): Promise<boolean> {
    const prisma = this.prisma as any
    const count = await prisma.callFact.count({
      where: {
        clientId,
        isInboundToCompany: true,
      },
    })

    return count > 0
  }

  async ensureDefinitions(): Promise<CallKpiDefinitionSet> {
    const prisma = this.prisma as any

    const [summary, hourly, agentRanking, hourlyComparison] = await Promise.all([
      prisma.kpiDefinition.upsert({
        where: { code: 'calls.summary' },
        create: {
          code: 'calls.summary',
          family: 'calls',
          granularity: 'summary',
          name: 'Call Summary',
          description: 'Summary metrics for call KPIs',
        },
        update: {
          family: 'calls',
          granularity: 'summary',
          name: 'Call Summary',
          description: 'Summary metrics for call KPIs',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'calls.hourly' },
        create: {
          code: 'calls.hourly',
          family: 'calls',
          granularity: 'hourly',
          name: 'Call Hourly Series',
          description: 'Hourly inbound call KPI series',
        },
        update: {
          family: 'calls',
          granularity: 'hourly',
          name: 'Call Hourly Series',
          description: 'Hourly inbound call KPI series',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'calls.agent_ranking' },
        create: {
          code: 'calls.agent_ranking',
          family: 'calls',
          granularity: 'ranking',
          name: 'Call Agent Ranking',
          description: 'Ranking breakdown for call KPIs',
        },
        update: {
          family: 'calls',
          granularity: 'ranking',
          name: 'Call Agent Ranking',
          description: 'Ranking breakdown for call KPIs',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'calls.hourly_comparison' },
        create: {
          code: 'calls.hourly_comparison',
          family: 'calls',
          granularity: 'hourly',
          name: 'Call Hourly Comparison',
          description: 'Hourly comparison between calls and telemarketing budgets',
        },
        update: {
          family: 'calls',
          granularity: 'hourly',
          name: 'Call Hourly Comparison',
          description: 'Hourly comparison between calls and telemarketing budgets',
          isActive: true,
        },
      }),
    ])

    return {
      summaryDefinitionId: summary.id,
      hourlyDefinitionId: hourly.id,
      agentRankingDefinitionId: agentRanking.id,
      hourlyComparisonDefinitionId: hourlyComparison.id,
    }
  }

  async listCallFacts(input: { clientId: string; from: Date; to: Date }): Promise<CallFactRecord[]> {
    const prisma = this.prisma as any
    const rows = await prisma.callFact.findMany({
      where: {
        clientId: input.clientId,
        startedAt: this.toTimestampWhere(input.from, input.to),
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        startedAt: true,
        isInboundToCompany: true,
        isReceived: true,
        isLost: true,
        agentResolutionType: true,
        agentResolutionKey: true,
        agentExtensionNumber: true,
        extensionUuid: true,
      },
    })

    return this.attachEmployeeNames(
      input.clientId,
      rows.map((row: CallFactEmployeeCandidate) => ({
        ...row,
        employeeName: null,
      })),
    )
  }

  async listTelemarketingBudgetFacts(input: {
    clientId: string
    from: Date
    to: Date
  }): Promise<TelemarketingBudgetFactRecord[]> {
    const prisma = this.prisma as any

    return prisma.budgetFact.findMany({
      where: {
        clientId: input.clientId,
        channel: 'Pedido Televendas',
        budgetDatetime: this.toTimestampWhere(input.from, input.to),
      },
      orderBy: [{ budgetDatetime: 'asc' }, { id: 'asc' }],
      select: {
        budgetDatetime: true,
        statusNormalized: true,
      },
    })
  }

  async createCalculationRun(input: CallKpiCalculationRunInput): Promise<{ id: bigint }> {
    const prisma = this.prisma as any
    const periodStart = KpiPeriod.toDatabaseDate(input.periodStart)
    const periodEnd = KpiPeriod.toDatabaseDate(input.periodEnd)

    const run = await prisma.kpiCalculationRun.create({
      data: {
        clientId: input.clientId,
        definitionId: input.definitionId,
        runKey: input.runKey,
        status: input.status,
        periodType: input.periodType,
        periodStart,
        periodEnd,
        recordsRead: input.recordsRead,
        recordsWritten: input.recordsWritten,
        metadataJson: input.metadataJson,
      },
      select: {
        id: true,
      },
    })

    return { id: run.id }
  }

  async completeCalculationRun(input: CallKpiCalculationRunUpdate): Promise<void> {
    const prisma = this.prisma as any

    await prisma.kpiCalculationRun.update({
      where: {
        id: input.runId,
      },
      data: {
        status: input.status ?? 'COMPLETED',
        recordsRead: input.recordsRead,
        recordsWritten: input.recordsWritten,
        finishedAt: input.finishedAt,
        errorMessage: null,
      },
    })
  }

  async failCalculationRun(input: CallKpiCalculationRunUpdate): Promise<void> {
    const prisma = this.prisma as any

    await prisma.kpiCalculationRun.update({
      where: {
        id: input.runId,
      },
      data: {
        status: input.status ?? 'FAILED',
        recordsRead: input.recordsRead,
        recordsWritten: input.recordsWritten,
        finishedAt: input.finishedAt,
        errorMessage: input.errorMessage ?? 'Call KPI refresh failed',
      },
    })
  }

  async persistMaterialization(input: {
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
  }): Promise<{ snapshotsCreated: number; breakdownsCreated: number }> {
    const prisma = this.prisma as any

    return prisma.$transaction(
      async (tx: any) => {
        const periodStart = KpiPeriod.toDatabaseDate(input.period.from)
        const periodEnd = KpiPeriod.toDatabaseDate(input.period.to)

        await tx.kpiSnapshot.deleteMany({
          where: {
            clientId: input.clientId,
            definitionId: input.summaryDefinitionId,
            periodType: KpiPeriod.periodType,
            periodStart,
            periodEnd,
          },
        })
        await tx.kpiBreakdown.deleteMany({
          where: {
            clientId: input.clientId,
            definitionId: input.hourlyDefinitionId,
            periodType: KpiPeriod.periodType,
            periodStart,
            periodEnd,
          },
        })
        await tx.kpiBreakdown.deleteMany({
          where: {
            clientId: input.clientId,
            definitionId: input.agentRankingDefinitionId,
            periodType: KpiPeriod.periodType,
            periodStart,
            periodEnd,
          },
        })
        await tx.kpiBreakdown.deleteMany({
          where: {
            clientId: input.clientId,
            definitionId: input.hourlyComparisonDefinitionId,
            periodType: KpiPeriod.periodType,
            periodStart,
            periodEnd,
          },
        })

        if (input.summaryRows.length > 0) {
          await tx.kpiSnapshot.createMany({
            data: input.summaryRows.map((row) => ({
              clientId: input.clientId,
              definitionId: input.summaryDefinitionId,
              periodType: KpiPeriod.periodType,
              periodStart,
              periodEnd,
              metricKey: row.metricKey,
              metricValue: new Prisma.Decimal(row.metricValue),
              dimensionsJson: row.dimensionsJson,
            })),
          })
        }

        if (input.hourlyRows.length > 0) {
          await tx.kpiBreakdown.createMany({
            data: input.hourlyRows.map((row) => ({
              clientId: input.clientId,
              definitionId: input.hourlyDefinitionId,
              periodType: KpiPeriod.periodType,
              periodStart,
              periodEnd,
              bucketDate: KpiPeriod.toDatabaseDate(row.bucketDate),
              dimensionType: row.dimensionType,
              dimensionKey: row.dimensionKey,
              dimensionLabel: row.dimensionLabel,
              metricKey: row.metricKey,
              metricValue: new Prisma.Decimal(row.metricValue),
              sortOrder: row.sortOrder,
              payloadJson: row.payloadJson,
            })),
          })
        }

        if (input.rankingRows.length > 0) {
          await tx.kpiBreakdown.createMany({
            data: input.rankingRows.map((row) => ({
              clientId: input.clientId,
              definitionId: input.agentRankingDefinitionId,
              periodType: KpiPeriod.periodType,
              periodStart,
              periodEnd,
              bucketDate: KpiPeriod.toDatabaseDate(row.bucketDate),
              dimensionType: row.dimensionType,
              dimensionKey: row.dimensionKey,
              dimensionLabel: row.dimensionLabel,
              metricKey: row.metricKey,
              metricValue: new Prisma.Decimal(row.metricValue),
              sortOrder: row.sortOrder,
              payloadJson: row.payloadJson,
            })),
          })
        }

        if (input.comparisonRows.length > 0) {
          await tx.kpiBreakdown.createMany({
            data: input.comparisonRows.map((row) => ({
              clientId: input.clientId,
              definitionId: input.hourlyComparisonDefinitionId,
              periodType: KpiPeriod.periodType,
              periodStart,
              periodEnd,
              bucketDate: KpiPeriod.toDatabaseDate(row.bucketDate),
              dimensionType: row.dimensionType,
              dimensionKey: row.dimensionKey,
              dimensionLabel: row.dimensionLabel,
              metricKey: row.metricKey,
              metricValue: new Prisma.Decimal(row.metricValue),
              sortOrder: row.sortOrder,
              payloadJson: row.payloadJson,
            })),
          })
        }

        return {
          snapshotsCreated: input.summaryRows.length,
          breakdownsCreated: input.hourlyRows.length + input.rankingRows.length + input.comparisonRows.length,
        }
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    )
  }

  async upsertAvailability(input: CallKpiAvailabilityUpdate): Promise<void> {
    const prisma = this.prisma as any

    await prisma.kpiAvailability.upsert({
      where: {
        clientId_definitionId: {
          clientId: input.clientId,
          definitionId: input.definitionId,
        },
      },
      create: {
        clientId: input.clientId,
        definitionId: input.definitionId,
        isEnabled: input.isEnabled,
        availableAt: input.availableAt,
        metadataJson: input.metadataJson,
      },
      update: {
        isEnabled: input.isEnabled,
        availableAt: input.availableAt,
        metadataJson: input.metadataJson,
      },
    })
  }

  async getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiSnapshotRow[]> {
    const prisma = this.prisma as any
    const periodStart = KpiPeriod.toDatabaseDate(input.period.from)
    const periodEnd = KpiPeriod.toDatabaseDate(input.period.to)

    const rows = await prisma.kpiSnapshot.findMany({
      where: {
        clientId: input.clientId,
        periodType: KpiPeriod.periodType,
        periodStart,
        periodEnd,
        definition: {
          code: 'calls.summary',
        },
      },
      orderBy: [{ metricKey: 'asc' }, { id: 'asc' }],
      select: {
        metricKey: true,
        metricValue: true,
        dimensionsJson: true,
      },
    })

    return rows.map((row: { metricKey: string; metricValue: { toString(): string }; dimensionsJson: unknown }) => ({
      metricKey: row.metricKey,
      metricValue: row.metricValue.toString(),
      dimensionsJson: (row.dimensionsJson ?? null) as Record<string, unknown> | null,
    }))
  }

  async getHourlyRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiBreakdownRow[]> {
    return this.getBreakdownRowsByDefinition({
      clientId: input.clientId,
      period: input.period,
      definitionCode: 'calls.hourly',
    })
  }

  async getAgentRankingRows(input: { clientId: string; period: KpiPeriod }): Promise<CallKpiBreakdownRow[]> {
    return this.getBreakdownRowsByDefinition({
      clientId: input.clientId,
      period: input.period,
      definitionCode: 'calls.agent_ranking',
    })
  }

  async getHourlyComparisonRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<CallKpiBreakdownRow[]> {
    return this.getBreakdownRowsByDefinition({
      clientId: input.clientId,
      period: input.period,
      definitionCode: 'calls.hourly_comparison',
    })
  }

  async getCallFactRows(input: { clientId: string; period: KpiPeriod }): Promise<CallFactRecord[]> {
    return this.listCallFacts({
      clientId: input.clientId,
      from: input.period.from,
      to: input.period.to,
    })
  }

  async getTelemarketingBudgetRows(input: {
    clientId: string
    period: KpiPeriod
  }): Promise<TelemarketingBudgetFactRecord[]> {
    return this.listTelemarketingBudgetFacts({
      clientId: input.clientId,
      from: input.period.from,
      to: input.period.to,
    })
  }

  private async getBreakdownRowsByDefinition(input: {
    clientId: string
    period: KpiPeriod
    definitionCode: string
  }): Promise<CallKpiBreakdownRow[]> {
    const prisma = this.prisma as any
    const periodStart = KpiPeriod.toDatabaseDate(input.period.from)
    const periodEnd = KpiPeriod.toDatabaseDate(input.period.to)

    const rows = await prisma.kpiBreakdown.findMany({
      where: {
        clientId: input.clientId,
        periodType: KpiPeriod.periodType,
        periodStart,
        periodEnd,
        definition: {
          code: input.definitionCode,
        },
      },
      orderBy: [{ bucketDate: 'asc' }, { dimensionKey: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        bucketDate: true,
        dimensionType: true,
        dimensionKey: true,
        dimensionLabel: true,
        metricKey: true,
        metricValue: true,
        payloadJson: true,
        sortOrder: true,
      },
    })

    return rows.map(
      (row: {
        bucketDate: Date | null
        dimensionType: string
        dimensionKey: string | null
        dimensionLabel: string | null
        metricKey: string
        metricValue: { toString(): string }
        payloadJson: unknown
        sortOrder: number
      }) => ({
        bucketDate: row.bucketDate ?? input.period.from,
        dimensionType: row.dimensionType,
        dimensionKey: row.dimensionKey,
        dimensionLabel: row.dimensionLabel,
        metricKey: row.metricKey,
        metricValue: row.metricValue.toString(),
        payloadJson: (row.payloadJson ?? null) as Record<string, unknown> | null,
        sortOrder: row.sortOrder,
      }),
    )
  }

  private async attachEmployeeNames(clientId: string, facts: CallFactRecord[]): Promise<CallFactRecord[]> {
    const extensionUuids = [...new Set(facts.map((fact) => fact.extensionUuid).filter(this.hasText))]
    const extensionNumbers = [
      ...new Set(
        facts
          .map((fact) => fact.agentExtensionNumber ?? fact.agentResolutionKey)
          .filter(this.hasText),
      ),
    ]

    if (extensionUuids.length === 0 && extensionNumbers.length === 0) {
      return facts
    }

    const prisma = this.prisma as any
    const employees = (await prisma.employee.findMany({
      where: {
        branch: {
          is: {
            clientId,
          },
        },
        OR: [
          ...(extensionUuids.length > 0 ? [{ extensionUuid: { in: extensionUuids } }] : []),
          ...(extensionNumbers.length > 0 ? [{ extensionNumber: { in: extensionNumbers } }] : []),
        ],
      },
      orderBy: [{ id: 'asc' }],
      select: {
        name: true,
        extensionUuid: true,
        extensionNumber: true,
      },
    })) as EmployeeLookupRow[]

    const byExtensionUuid = new Map<string, string | null>()
    const byExtensionNumber = new Map<string, string | null>()

    for (const employee of employees) {
      if (this.hasText(employee.extensionUuid)) {
        this.storeUniqueEmployeeName(byExtensionUuid, employee.extensionUuid, employee.name)
      }

      if (this.hasText(employee.extensionNumber)) {
        this.storeUniqueEmployeeName(byExtensionNumber, employee.extensionNumber, employee.name)
      }
    }

    return facts.map((fact) => {
      const employeeNameByUuid =
        fact.extensionUuid && byExtensionUuid.has(fact.extensionUuid)
          ? byExtensionUuid.get(fact.extensionUuid)
          : undefined

      if (employeeNameByUuid !== undefined) {
        return {
          ...fact,
          employeeName: employeeNameByUuid,
        }
      }

      const employeeNameByExtension =
        fact.agentExtensionNumber && byExtensionNumber.has(fact.agentExtensionNumber)
          ? byExtensionNumber.get(fact.agentExtensionNumber)
          : fact.agentResolutionKey && byExtensionNumber.has(fact.agentResolutionKey)
            ? byExtensionNumber.get(fact.agentResolutionKey)
            : undefined

      return {
        ...fact,
        employeeName: employeeNameByExtension ?? null,
      }
    })
  }

  private toTimestampWhere(from: Date, to: Date): { gte: Date; lt: Date } {
    return {
      gte: from,
      lt: this.addDays(to, 1),
    }
  }

  private storeUniqueEmployeeName(map: Map<string, string | null>, key: string, name: string): void {
    if (!map.has(key)) {
      map.set(key, name)
      return
    }

    const current = map.get(key)

    if (current !== name) {
      map.set(key, null)
    }
  }

  private addDays(value: Date, days: number): Date {
    const next = new Date(value.getTime())
    next.setUTCDate(next.getUTCDate() + days)
    return next
  }

  private hasText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim() !== ''
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    return this.hasText(value) ? value.trim() : null
  }
}
