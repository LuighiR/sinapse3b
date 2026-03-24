import { Injectable, Module } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { NormalizationModule } from '../normalization/normalization.module'
import { BudgetNormalizationService } from '../normalization/application/budget-normalization.service'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../auth/presentation/guards/tenant-scope.guard'
import {
  BudgetKpiAvailabilityRepository,
  BudgetKpiAvailabilityUpdate,
  BudgetKpiAvailabilityService,
} from './application/budget-kpi-availability.service'
import {
  BudgetKpiDrilldownFactRow,
  BudgetKpiQueryRepository,
  BudgetKpiQueryService,
} from './application/budget-kpi-query.service'
import {
  BudgetFactRecord,
  BudgetKpiBreakdownRow,
  BudgetKpiCalculationRunInput,
  BudgetKpiCalculationRunUpdate,
  BudgetKpiDefinitionSet,
  BudgetKpiRefreshRepository,
  BudgetKpiRefreshService,
  BudgetKpiSnapshotRow,
} from './application/budget-kpi-refresh.service'
import { KpiPeriod } from './domain/kpi-period'
import { KpiController } from './presentation/kpi.controller'

@Injectable()
class PrismaBudgetKpiRepository
  implements BudgetKpiRefreshRepository, BudgetKpiAvailabilityRepository, BudgetKpiQueryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async hasUsableBudgetFacts(clientId: string): Promise<boolean> {
    const prisma = this.prisma as any
    const count = await prisma.budgetFact.count({
      where: {
        clientId,
      },
    })

    return count > 0
  }

  async ensureDefinitions(): Promise<BudgetKpiDefinitionSet> {
    const prisma = this.prisma as any

    const [summary, daily, drilldown] = await Promise.all([
      prisma.kpiDefinition.upsert({
        where: { code: 'budgets.summary' },
        create: {
          code: 'budgets.summary',
          family: 'budgets',
          granularity: 'summary',
          name: 'Budget Summary',
          description: 'Summary metrics for budget KPIs',
        },
        update: {
          family: 'budgets',
          granularity: 'summary',
          name: 'Budget Summary',
          description: 'Summary metrics for budget KPIs',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'budgets.daily' },
        create: {
          code: 'budgets.daily',
          family: 'budgets',
          granularity: 'daily',
          name: 'Budget Daily Series',
          description: 'Daily budget KPI series',
        },
        update: {
          family: 'budgets',
          granularity: 'daily',
          name: 'Budget Daily Series',
          description: 'Daily budget KPI series',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'budgets.drilldown' },
        create: {
          code: 'budgets.drilldown',
          family: 'budgets',
          granularity: 'drilldown',
          name: 'Budget Drilldown',
          description: 'Seller drilldown for budget KPIs',
        },
        update: {
          family: 'budgets',
          granularity: 'drilldown',
          name: 'Budget Drilldown',
          description: 'Seller drilldown for budget KPIs',
          isActive: true,
        },
      }),
    ])

    return {
      summaryDefinitionId: summary.id,
      dailyDefinitionId: daily.id,
      drilldownDefinitionId: drilldown.id,
    }
  }

  async listBudgetFacts(input: { clientId: string; from: Date; to: Date }): Promise<BudgetFactRecord[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.from)
    const to = KpiPeriod.toDatabaseDate(input.to)

    return prisma.budgetFact.findMany({
      where: {
        clientId: input.clientId,
        budgetDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ budgetDate: 'asc' }, { sellerId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        budgetDate: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        valueAmount: true,
      },
    })
  }

  async createCalculationRun(input: BudgetKpiCalculationRunInput): Promise<{ id: bigint }> {
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

  async completeCalculationRun(input: BudgetKpiCalculationRunUpdate): Promise<void> {
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

  async failCalculationRun(input: BudgetKpiCalculationRunUpdate): Promise<void> {
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
        errorMessage: input.errorMessage ?? 'Budget KPI refresh failed',
      },
    })
  }

  async persistMaterialization(input: {
    clientId: string
    summaryDefinitionId: bigint
    dailyDefinitionId: bigint
    drilldownDefinitionId: bigint
    period: KpiPeriod
    summaryRows: BudgetKpiSnapshotRow[]
    dailyRows: BudgetKpiBreakdownRow[]
    drilldownRows: BudgetKpiBreakdownRow[]
  }): Promise<{ snapshotsCreated: number; breakdownsCreated: number }> {
    const prisma = this.prisma as any

    return prisma.$transaction(async (tx: any) => {
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
          definitionId: input.dailyDefinitionId,
          periodType: KpiPeriod.periodType,
          periodStart,
          periodEnd,
        },
      })
      await tx.kpiBreakdown.deleteMany({
        where: {
          clientId: input.clientId,
          definitionId: input.drilldownDefinitionId,
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

      if (input.dailyRows.length > 0) {
        await tx.kpiBreakdown.createMany({
          data: input.dailyRows.map((row) => ({
            clientId: input.clientId,
            definitionId: input.dailyDefinitionId,
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

      if (input.drilldownRows.length > 0) {
        await tx.kpiBreakdown.createMany({
          data: input.drilldownRows.map((row) => ({
            clientId: input.clientId,
            definitionId: input.drilldownDefinitionId,
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
        breakdownsCreated: input.dailyRows.length + input.drilldownRows.length,
      }
    })
  }

  async upsertAvailability(input: BudgetKpiAvailabilityUpdate): Promise<void> {
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

  async getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiSnapshotRow[]> {
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
          code: 'budgets.summary',
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

  async getDailyRows(input: { clientId: string; period: KpiPeriod }): Promise<BudgetKpiBreakdownRow[]> {
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
          code: 'budgets.daily',
        },
      },
      orderBy: [{ bucketDate: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
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

  async getBudgetFactRows(input: {
    clientId: string
    period: KpiPeriod
    sellerId?: number
  }): Promise<BudgetFactRecord[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.period.from)
    const to = KpiPeriod.toDatabaseDate(input.period.to)

    return prisma.budgetFact.findMany({
      where: {
        clientId: input.clientId,
        budgetDate: {
          gte: from,
          lte: to,
        },
        ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
      },
      orderBy: [{ budgetDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        budgetDate: true,
        budgetDatetime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        valueAmount: true,
      },
    })
  }

  async getDrilldownRows(input: {
    clientId: string
    period: KpiPeriod
    sellerId?: number
    branchId?: number
    branchName?: string
  }): Promise<BudgetKpiDrilldownFactRow[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.period.from)
    const to = KpiPeriod.toDatabaseDate(input.period.to)

    const rows = await prisma.budgetFact.findMany({
      where: {
        clientId: input.clientId,
        budgetDate: {
          gte: from,
          lte: to,
        },
        ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.branchName !== undefined ? { branchName: input.branchName } : {}),
      },
      orderBy: [{ budgetDate: 'asc' }, { sellerId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        clientId: true,
        sourceTable: true,
        sourceRecordId: true,
        branchName: true,
        branchId: true,
        sellerId: true,
        sellerName: true,
        budgetDate: true,
        budgetDatetime: true,
        closingDate: true,
        statusNormalized: true,
        channel: true,
        customerName: true,
        cpfCnpj: true,
        valueAmount: true,
        sequential: true,
        davId: true,
        sequentialLinkedSale: true,
        payloadJson: true,
      },
    })

    return rows.map(
      (row: {
        id: bigint
        clientId: string
        sourceTable: string
        sourceRecordId: number
        branchName: string
        branchId: number | null
        sellerId: number
        sellerName: string
        budgetDate: Date | string
        budgetDatetime: Date | string
        closingDate: Date | string | null
        statusNormalized: string
        channel: string | null
        customerName: string
        cpfCnpj: string | null
        valueAmount: { toString(): string }
        sequential: bigint | number | null
        davId: bigint
        sequentialLinkedSale: bigint | number | null
        payloadJson: unknown
      }) => ({
        id: row.id,
        clientId: row.clientId,
        sourceTable: row.sourceTable,
        sourceRecordId: row.sourceRecordId,
        branchName: row.branchName,
        branchId: row.branchId,
        sellerId: row.sellerId,
        sellerName: row.sellerName,
        budgetDate: this.toDateKey(row.budgetDate),
        budgetDatetime: this.toTimestampText(row.budgetDatetime),
        closingDate: row.closingDate === null ? null : this.toDateKey(row.closingDate),
        statusNormalized: row.statusNormalized,
        channel: row.channel,
        customerName: row.customerName,
        cpfCnpj: row.cpfCnpj,
        valueAmount: row.valueAmount.toString(),
        sequential: row.sequential,
        davId: row.davId,
        sequentialLinkedSale: row.sequentialLinkedSale,
        payloadJson: (row.payloadJson ?? null) as Record<string, unknown> | null,
      }),
    )
  }

  private toDateKey(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10)
    }

    return value.toISOString().slice(0, 10)
  }

  private toTimestampText(value: Date | string): string {
    if (typeof value === 'string') {
      return value
    }

    return value.toISOString()
  }
}

@Module({
  imports: [PrismaModule, AuthModule, NormalizationModule],
  providers: [
    PrismaBudgetKpiRepository,
    JwtAuthGuard,
    TenantScopeGuard,
    {
      provide: BudgetKpiAvailabilityService,
      useFactory: (repository: PrismaBudgetKpiRepository) => new BudgetKpiAvailabilityService(repository),
      inject: [PrismaBudgetKpiRepository],
    },
    {
      provide: BudgetKpiRefreshService,
      useFactory: (
        repository: PrismaBudgetKpiRepository,
        availabilityService: BudgetKpiAvailabilityService,
        budgetNormalizationService: BudgetNormalizationService,
      ) => new BudgetKpiRefreshService(repository, availabilityService, budgetNormalizationService),
      inject: [PrismaBudgetKpiRepository, BudgetKpiAvailabilityService, BudgetNormalizationService],
    },
    {
      provide: BudgetKpiQueryService,
      useFactory: (repository: PrismaBudgetKpiRepository) => new BudgetKpiQueryService(repository),
      inject: [PrismaBudgetKpiRepository],
    },
  ],
  controllers: [KpiController],
  exports: [BudgetKpiAvailabilityService, BudgetKpiRefreshService, BudgetKpiQueryService],
})
export class KpiModule {}
