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
import { CallKpiQueryRepository, type CallKpiDrilldownPage, type CallKpiDrilldownRepositoryInput, type CallKpiFilterOptionsResult, type CallOutcome } from '../application/call-kpi-query.service'

type EmployeeLookupRow = {
  id: number
  name: string
  extensionUuid: string
  extensionNumber: string
}

type BranchEmployeeLookupMatch = {
  employeeId: number
  employeeName: string
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

  async listCallFacts(input: { clientId: string; from: Date; to: Date; branchId?: number }): Promise<CallFactRecord[]> {
    const prisma = this.prisma as any
    if (input.branchId === undefined) {
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

    return this.attachBranchCallFacts(input.clientId, input.branchId, input.from, input.to)
  }

  async listTelemarketingBudgetFacts(input: {
    clientId: string
    from: Date
    to: Date
    branchId?: number
  }): Promise<TelemarketingBudgetFactRecord[]> {
    const prisma = this.prisma as any

    return prisma.budgetFact.findMany({
      where: {
        clientId: input.clientId,
        channel: 'Pedido Televendas',
        budgetDatetime: this.toTimestampWhere(input.from, input.to),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
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

  async getCallFactRows(input: { clientId: string; period: KpiPeriod; branchId?: number }): Promise<CallFactRecord[]> {
    return this.listCallFacts({
      clientId: input.clientId,
      from: input.period.from,
      to: input.period.to,
      branchId: input.branchId,
    })
  }

  async getTelemarketingBudgetRows(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
  }): Promise<TelemarketingBudgetFactRecord[]> {
    return this.listTelemarketingBudgetFacts({
      clientId: input.clientId,
      from: input.period.from,
      to: input.period.to,
      branchId: input.branchId,
    })
  }

  async getDrilldownPage(input: CallKpiDrilldownRepositoryInput): Promise<CallKpiDrilldownPage> {
    const prisma = this.prisma as any
    const agentFilter = await this.buildAgentFilter(input.clientId, input)

    if (agentFilter === null) {
      return { total: 0, rows: [] }
    }

    const direction = this.normalizeOptionalText(input.direction)
    const where = {
      clientId: input.clientId,
      startedAt: this.toTimestampWhere(input.period.from, input.period.to),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(direction !== null ? { direction } : {}),
      ...(input.callerNumber !== undefined
        ? { callerNumber: { contains: input.callerNumber, mode: 'insensitive' } }
        : {}),
      ...(input.destinationNumber !== undefined
        ? { destinationNumber: { contains: input.destinationNumber, mode: 'insensitive' } }
        : {}),
      ...this.buildDurationWhere(input.durationMin, input.durationMax),
      ...this.buildOutcomeWhere(input.outcome),
      ...agentFilter,
    }

    const [total, rows] = await Promise.all([
      prisma.callFact.count({ where }),
      prisma.callFact.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          direction: true,
          status: true,
          callerNumber: true,
          destinationNumber: true,
          extensionUuid: true,
          agentExtensionNumber: true,
          agentResolutionKey: true,
          isInboundToCompany: true,
          isReceived: true,
          isLost: true,
          branchId: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      }),
    ])

    const enriched = await this.attachEmployeeNames(
      input.clientId,
      rows.map((row: any) => ({
        id: row.id,
        startedAt: row.startedAt,
        isInboundToCompany: row.isInboundToCompany,
        isReceived: row.isReceived,
        isLost: row.isLost,
        agentResolutionType: null,
        agentResolutionKey: row.agentResolutionKey,
        agentExtensionNumber: row.agentExtensionNumber,
        extensionUuid: row.extensionUuid,
        employeeName: null,
      })),
    )

    const employeeByFactKey = new Map(
      enriched.map((fact) => [
        `${String(fact.id)}`,
        { employeeId: fact.employeeId ?? null, employeeName: fact.employeeName },
      ]),
    )

    return {
      total,
      rows: rows
        .filter((row: any) => employeeByFactKey.has(String(row.id)))
        .map((row: any) => {
          const employee = employeeByFactKey.get(String(row.id))

          return {
            id: row.id,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            durationSeconds: row.durationSeconds.toString(),
            direction: row.direction,
            status: row.status,
            callerNumber: row.callerNumber,
            destinationNumber: row.destinationNumber,
            extensionUuid: row.extensionUuid,
            agentExtensionNumber: row.agentExtensionNumber,
            isInboundToCompany: row.isInboundToCompany,
            isReceived: row.isReceived,
            isLost: row.isLost,
            branchId: row.branchId,
            branchName: row.branch?.name ?? null,
            employeeId: employee?.employeeId ?? null,
            employeeName: employee?.employeeName ?? null,
          }
        }),
    }
  }

  async countLostWithoutEmployee(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
  }): Promise<number> {
    const prisma = this.prisma as any
    const withoutEmployeeFilter = await this.buildWithoutEmployeeFilter(input.clientId, input.branchId)

    return prisma.callFact.count({
      where: {
        clientId: input.clientId,
        startedAt: this.toTimestampWhere(input.period.from, input.period.to),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        direction: 'inbound',
        isLost: true,
        ...withoutEmployeeFilter,
      },
    })
  }

  async getFilterOptions(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
  }): Promise<CallKpiFilterOptionsResult> {
    const prisma = this.prisma as any
    const where = {
      clientId: input.clientId,
      startedAt: this.toTimestampWhere(input.period.from, input.period.to),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    }

    const [statusRows, directionRows] = await Promise.all([
      prisma.callFact.findMany({
        where: {
          ...where,
          status: { not: null },
        },
        distinct: ['status'],
        select: { status: true },
        orderBy: { status: 'asc' },
      }),
      prisma.callFact.findMany({
        where: {
          ...where,
          direction: { not: null },
        },
        distinct: ['direction'],
        select: { direction: true },
        orderBy: { direction: 'asc' },
      }),
    ])

    return {
      statuses: statusRows
        .map((row: { status: string | null }) => row.status)
        .filter((value: string | null): value is string => value != null && value.trim() !== ''),
      directions: directionRows
        .map((row: { direction: string | null }) => row.direction)
        .filter((value: string | null): value is string => value != null && value.trim() !== ''),
    }
  }

  private async buildAgentFilter(
    clientId: string,
    input: Pick<
      CallKpiDrilldownRepositoryInput,
      'employeeId' | 'extensionUuid' | 'extensionNumber' | 'withoutEmployee' | 'branchId'
    >,
  ): Promise<Record<string, unknown> | null | Record<string, never>> {
    if (input.withoutEmployee === true) {
      return this.buildWithoutEmployeeFilter(clientId, input.branchId)
    }

    if (input.employeeId !== undefined) {
      const prisma = this.prisma as any
      const employee = await prisma.employee.findFirst({
        where: {
          id: input.employeeId,
          branch: { clientId },
        },
        select: {
          extensionUuid: true,
          extensionNumber: true,
        },
      })

      if (employee === null) {
        return null
      }

      const orFilters: Array<Record<string, unknown>> = []

      if (this.hasText(employee.extensionUuid)) {
        orFilters.push({ extensionUuid: employee.extensionUuid })
      }

      if (this.hasText(employee.extensionNumber)) {
        orFilters.push({ agentExtensionNumber: employee.extensionNumber })
        orFilters.push({ agentResolutionKey: employee.extensionNumber })
      }

      if (orFilters.length === 0) {
        return null
      }

      return { OR: orFilters }
    }

    const extensionUuid = this.normalizeOptionalText(input.extensionUuid)
    const extensionNumber = this.normalizeOptionalText(input.extensionNumber)

    if (extensionUuid === null && extensionNumber === null) {
      return {}
    }

    const orFilters: Array<Record<string, unknown>> = []

    if (extensionUuid !== null) {
      orFilters.push({ extensionUuid })
    }

    if (extensionNumber !== null) {
      orFilters.push({ agentExtensionNumber: extensionNumber })
      orFilters.push({ agentResolutionKey: extensionNumber })
    }

    return { OR: orFilters }
  }

  private async buildWithoutEmployeeFilter(
    clientId: string,
    branchId?: number,
  ): Promise<Record<string, unknown>> {
    const prisma = this.prisma as any
    const employees = (await prisma.employee.findMany({
      where: {
        branch: {
          is: {
            clientId,
            ...(branchId !== undefined ? { id: branchId } : {}),
          },
        },
      },
      orderBy: [{ id: 'asc' }],
      select: {
        id: true,
        name: true,
        extensionUuid: true,
        extensionNumber: true,
      },
    })) as EmployeeLookupRow[]

    const byExtensionUuid = new Map<string, EmployeeLookupRow | null>()
    const byExtensionNumber = new Map<string, EmployeeLookupRow | null>()

    for (const employee of employees) {
      if (this.hasText(employee.extensionUuid)) {
        this.storeUniqueEmployeeLookup(byExtensionUuid, employee.extensionUuid, employee)
      }

      if (this.hasText(employee.extensionNumber)) {
        this.storeUniqueEmployeeLookup(byExtensionNumber, employee.extensionNumber, employee)
      }
    }

    const uniqueExtensionUuids = [...byExtensionUuid.entries()]
      .filter(([, employee]) => employee !== null)
      .map(([key]) => key)
    const uniqueExtensionNumbers = [...byExtensionNumber.entries()]
      .filter(([, employee]) => employee !== null)
      .map(([key]) => key)
    const uniqueExtensionNumbersForExclusion = uniqueExtensionNumbers.filter(
      (extensionNumber) => !this.isQueueExtensionNumber(extensionNumber),
    )

    if (uniqueExtensionUuids.length === 0 && uniqueExtensionNumbersForExclusion.length === 0) {
      return {}
    }

    // NULL-safe "does not uniquely match employee":
    // `NOT (extensionUuid IN (...))` drops rows where extensionUuid IS NULL in SQL.
    // Queue losses usually have null extensionUuid + 3-digit agentExtensionNumber.
    const andFilters: Array<Record<string, unknown>> = []

    if (uniqueExtensionUuids.length > 0) {
      andFilters.push({
        OR: [{ extensionUuid: null }, { NOT: { extensionUuid: { in: uniqueExtensionUuids } } }],
      })
    }

    if (uniqueExtensionNumbersForExclusion.length > 0) {
      andFilters.push({
        OR: [
          { agentExtensionNumber: null },
          { NOT: { agentExtensionNumber: { in: uniqueExtensionNumbersForExclusion } } },
        ],
      })
      andFilters.push({
        OR: [
          { agentResolutionKey: null },
          { NOT: { agentResolutionKey: { in: uniqueExtensionNumbersForExclusion } } },
        ],
      })
    }

    return {
      AND: andFilters,
    }
  }

  private buildDurationWhere(
    durationMin?: number,
    durationMax?: number,
  ): Record<string, unknown> {
    if (durationMin === undefined && durationMax === undefined) {
      return {}
    }

    return {
      durationSeconds: {
        ...(durationMin !== undefined ? { gte: durationMin } : {}),
        ...(durationMax !== undefined ? { lte: durationMax } : {}),
      },
    }
  }

  private buildOutcomeWhere(outcome?: CallOutcome): Record<string, unknown> {
    if (outcome === 'ANSWERED') {
      return { isReceived: true }
    }

    if (outcome === 'UNANSWERED') {
      return { isLost: true }
    }

    if (outcome === 'UNCLASSIFIED') {
      return { isReceived: false, isLost: false }
    }

    return {}
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
        id: true,
        name: true,
        extensionUuid: true,
        extensionNumber: true,
      },
    })) as EmployeeLookupRow[]

    const byExtensionUuid = new Map<string, EmployeeLookupRow | null>()
    const byExtensionNumber = new Map<string, EmployeeLookupRow | null>()

    for (const employee of employees) {
      if (this.hasText(employee.extensionUuid)) {
        this.storeUniqueEmployeeLookup(byExtensionUuid, employee.extensionUuid, employee)
      }

      if (this.hasText(employee.extensionNumber)) {
        this.storeUniqueEmployeeLookup(byExtensionNumber, employee.extensionNumber, employee)
      }
    }

    return facts.flatMap((fact) => {
      const employeeByUuid =
        fact.extensionUuid && byExtensionUuid.has(fact.extensionUuid)
          ? byExtensionUuid.get(fact.extensionUuid)
          : undefined

      if (employeeByUuid !== undefined) {
        return [
          {
            ...fact,
            employeeId: employeeByUuid?.id ?? null,
            employeeName: employeeByUuid?.name ?? null,
          },
        ]
      }

      const employeeByExtension =
        fact.agentExtensionNumber && byExtensionNumber.has(fact.agentExtensionNumber)
          ? byExtensionNumber.get(fact.agentExtensionNumber)
          : fact.agentResolutionKey && byExtensionNumber.has(fact.agentResolutionKey)
            ? byExtensionNumber.get(fact.agentResolutionKey)
            : undefined

      return [
        {
          ...fact,
          employeeId: employeeByExtension?.id ?? null,
          employeeName: employeeByExtension?.name ?? null,
        },
      ]
    })
  }

  private async attachBranchCallFacts(
    clientId: string,
    branchId: number,
    from: Date,
    to: Date,
  ): Promise<CallFactRecord[]> {
    const prisma = this.prisma as any
    const employees = (await prisma.employee.findMany({
      where: {
        branchId,
      },
      orderBy: [{ id: 'asc' }],
      select: {
        id: true,
        name: true,
        extensionUuid: true,
        extensionNumber: true,
      },
    })) as EmployeeLookupRow[]

    const uniqueLookup = this.buildUniqueBranchEmployeeLookup(employees)

    const candidates = (await prisma.callFact.findMany({
      where: {
        clientId,
        branchId,
        startedAt: this.toTimestampWhere(from, to),
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
    })) as CallFactRecord[]

    return candidates.flatMap((fact): CallFactRecord[] => {
      const baseFact: CallFactRecord = {
        ...fact,
        employeeId: null,
        employeeName: null,
      }
      const employeeNameByUuid = this.resolveEmployeeByExtensionUuid(uniqueLookup.byExtensionUuid, fact.extensionUuid)

      if (employeeNameByUuid === null) {
        return [baseFact]
      }

      if (employeeNameByUuid !== undefined) {
        return [
          {
            ...fact,
            employeeId: employeeNameByUuid.employeeId,
            employeeName: employeeNameByUuid.employeeName,
          },
        ]
      }

      const primaryExtensionNumber = this.normalizeOptionalText(fact.agentExtensionNumber)

      if (primaryExtensionNumber !== null) {
        const employeeNameByPrimary = this.resolveEmployeeByExtensionNumber(
          uniqueLookup.byExtensionNumber,
          primaryExtensionNumber,
        )

        if (employeeNameByPrimary === null) {
          return [baseFact]
        }

        if (employeeNameByPrimary === undefined) {
          return [baseFact]
        }

        return [
          {
            ...fact,
            employeeId: employeeNameByPrimary.employeeId,
            employeeName: employeeNameByPrimary.employeeName,
          },
        ]
      }

      const secondaryExtensionNumber = this.normalizeOptionalText(fact.agentResolutionKey)

      if (secondaryExtensionNumber !== null) {
        const employeeNameBySecondary = this.resolveEmployeeByExtensionNumber(
          uniqueLookup.byExtensionNumber,
          secondaryExtensionNumber,
        )

        if (employeeNameBySecondary === null) {
          return [baseFact]
        }

        if (employeeNameBySecondary !== undefined) {
          return [
            {
              ...fact,
              employeeId: employeeNameBySecondary.employeeId,
              employeeName: employeeNameBySecondary.employeeName,
            },
          ]
        }
      }

      return [baseFact]
    })
  }

  private buildUniqueBranchEmployeeLookup(employees: EmployeeLookupRow[]): {
    byExtensionUuid: Map<string, BranchEmployeeLookupMatch | null>
    byExtensionNumber: Map<string, BranchEmployeeLookupMatch | null>
  } {
    const byExtensionUuid = new Map<string, BranchEmployeeLookupMatch | null>()
    const byExtensionNumber = new Map<string, BranchEmployeeLookupMatch | null>()

    for (const employee of employees) {
      if (this.hasText(employee.extensionUuid)) {
        this.storeUniqueBranchEmployeeMatch(byExtensionUuid, employee.extensionUuid, employee)
      }

      if (this.hasText(employee.extensionNumber)) {
        this.storeUniqueBranchEmployeeMatch(byExtensionNumber, employee.extensionNumber, employee)
      }
    }

    return {
      byExtensionUuid,
      byExtensionNumber,
    }
  }

  private resolveEmployeeByExtensionUuid(
    map: Map<string, BranchEmployeeLookupMatch | null>,
    extensionUuid: string | null,
  ): BranchEmployeeLookupMatch | null | undefined {
    if (!this.hasText(extensionUuid)) {
      return undefined
    }

    if (!map.has(extensionUuid)) {
      return undefined
    }

    const value = map.get(extensionUuid)
    return value
  }

  private resolveEmployeeByExtensionNumber(
    map: Map<string, BranchEmployeeLookupMatch | null>,
    extensionNumber: string | null,
  ): BranchEmployeeLookupMatch | null | undefined {
    if (!this.hasText(extensionNumber)) {
      return undefined
    }

    if (!map.has(extensionNumber)) {
      return undefined
    }

    const value = map.get(extensionNumber)
    return value
  }

  private storeUniqueBranchEmployeeMatch(
    map: Map<string, BranchEmployeeLookupMatch | null>,
    key: string,
    employee: EmployeeLookupRow,
  ): void {
    if (!map.has(key)) {
      map.set(key, {
        employeeId: employee.id,
        employeeName: employee.name,
      })
      return
    }

    map.set(key, null)
  }

  private toTimestampWhere(from: Date, to: Date): { gte: Date; lt: Date } {
    return {
      gte: from,
      lt: this.addDays(to, 1),
    }
  }

  private storeUniqueEmployeeLookup(map: Map<string, EmployeeLookupRow | null>, key: string, employee: EmployeeLookupRow): void {
    if (!map.has(key)) {
      map.set(key, employee)
      return
    }

    const current = map.get(key)

    if (current?.name !== employee.name) {
      map.set(key, null)
    }
  }

  private addDays(value: Date, days: number): Date {
    const next = new Date(value.getTime())
    next.setUTCDate(next.getUTCDate() + days)
    return next
  }

  private isQueueExtensionNumber(value: string): boolean {
    return /^\d{3}$/.test(value)
  }

  private hasText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim() !== ''
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    return this.hasText(value) ? value.trim() : null
  }
}
