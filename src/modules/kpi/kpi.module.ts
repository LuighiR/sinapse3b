import { Injectable, Module } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { CompaniesModule } from '../companies/companies.module'
import { NormalizationModule } from '../normalization/normalization.module'
import { BudgetNormalizationService } from '../normalization/application/budget-normalization.service'
import { CallNormalizationService } from '../normalization/application/call-normalization.service'
import { SaleNormalizationService } from '../normalization/application/sale-normalization.service'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../auth/presentation/guards/tenant-scope.guard'
import { BudgetFollowUpDkwDispatchService } from './application/budget-follow-up-dkw-dispatch.service'
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
import {
  SaleKpiAvailabilityRepository,
  SaleKpiAvailabilityService,
  SaleKpiAvailabilityUpdate,
} from './application/sale-kpi-availability.service'
import {
  SaleKpiDrilldownFactRow,
  SaleKpiQueryRepository,
  SaleKpiQueryService,
} from './application/sale-kpi-query.service'
import {
  SaleFactRecord,
  SaleKpiBreakdownRow as SaleKpiBreakdownMaterializationRow,
  SaleKpiCalculationRunInput,
  SaleKpiCalculationRunUpdate,
  SaleKpiDefinitionSet,
  SaleKpiRefreshRepository,
  SaleKpiRefreshService,
  SaleKpiSnapshotRow as SaleKpiSnapshotMaterializationRow,
} from './application/sale-kpi-refresh.service'
import { SalesKpiController } from './presentation/sales-kpi.controller'
import {
  CallKpiAvailabilityService,
} from './application/call-kpi-availability.service'
import { CallKpiQueryService } from './application/call-kpi-query.service'
import { CallKpiRefreshService } from './application/call-kpi-refresh.service'
import { WhatsAppKpiQueryService } from './application/whatsapp-kpi-query.service'
import { CallKpiController } from './presentation/call-kpi.controller'
import { WhatsAppKpiController } from './presentation/whatsapp-kpi.controller'
import { FetchBudgetFollowUpDkwWebhookClient } from './infrastructure/fetch-budget-follow-up-dkw-webhook.client'
import { PrismaBudgetFollowUpDkwDispatchRepository } from './infrastructure/prisma-budget-follow-up-dkw-dispatch.repository'
import { PrismaCallKpiRepository } from './infrastructure/prisma-call-kpi.repository'
import { PrismaWhatsAppKpiRepository } from './infrastructure/prisma-whatsapp-kpi.repository'
import { BranchScopeService } from '../companies/application/branch-scope.service'

@Injectable()
export class PrismaBudgetKpiRepository
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
        budgetDatetime: true,
        closingDate: true,
        cancellationDate: true,
        cancelationTime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        valueAmount: true,
        payloadJson: true,
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
    branchId?: number
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
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
      },
      orderBy: [{ budgetDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        budgetDate: true,
        budgetDatetime: true,
        closingDate: true,
        cancellationDate: true,
        cancelationTime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        valueAmount: true,
        payloadJson: true,
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
        cancellationDate: true,
        cancelationTime: true,
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
        cancellationDate: Date | string | null
        cancelationTime: string | null
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
        cancellationDate: row.cancellationDate === null ? null : this.toDateKey(row.cancellationDate),
        cancelationTime: row.cancelationTime,
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

@Injectable()
export class PrismaSaleKpiRepository
  implements SaleKpiRefreshRepository, SaleKpiAvailabilityRepository, SaleKpiQueryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async hasUsableSaleFacts(clientId: string): Promise<boolean> {
    const prisma = this.prisma as any
    const count = await prisma.saleFact.count({
      where: {
        clientId,
      },
    })

    return count > 0
  }

  async ensureDefinitions(): Promise<SaleKpiDefinitionSet> {
    const prisma = this.prisma as any

    const [summary, daily] = await Promise.all([
      prisma.kpiDefinition.upsert({
        where: { code: 'sales.summary' },
        create: {
          code: 'sales.summary',
          family: 'sales',
          granularity: 'summary',
          name: 'Sales Summary',
          description: 'Summary metrics for sales KPIs',
        },
        update: {
          family: 'sales',
          granularity: 'summary',
          name: 'Sales Summary',
          description: 'Summary metrics for sales KPIs',
          isActive: true,
        },
      }),
      prisma.kpiDefinition.upsert({
        where: { code: 'sales.daily' },
        create: {
          code: 'sales.daily',
          family: 'sales',
          granularity: 'daily',
          name: 'Sales Daily Series',
          description: 'Daily sales KPI series',
        },
        update: {
          family: 'sales',
          granularity: 'daily',
          name: 'Sales Daily Series',
          description: 'Daily sales KPI series',
          isActive: true,
        },
      }),
    ])

    return {
      summaryDefinitionId: summary.id,
      dailyDefinitionId: daily.id,
    }
  }

  async listSaleFacts(input: { clientId: string; from: Date; to: Date }): Promise<SaleFactRecord[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.from)
    const to = KpiPeriod.toDatabaseDate(input.to)

    return prisma.saleFact.findMany({
      where: {
        clientId: input.clientId,
        saleDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ saleDate: 'asc' }, { sellerId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        saleDate: true,
        saleDatetime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        hasLinkedBudget: true,
        valueAmount: true,
      },
    })
  }

  async createCalculationRun(input: SaleKpiCalculationRunInput): Promise<{ id: bigint }> {
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

  async completeCalculationRun(input: SaleKpiCalculationRunUpdate): Promise<void> {
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

  async failCalculationRun(input: SaleKpiCalculationRunUpdate): Promise<void> {
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
        errorMessage: input.errorMessage ?? 'Sale KPI refresh failed',
      },
    })
  }

  async persistMaterialization(input: {
    clientId: string
    summaryDefinitionId: bigint
    dailyDefinitionId: bigint
    period: KpiPeriod
    summaryRows: SaleKpiSnapshotMaterializationRow[]
    dailyRows: SaleKpiBreakdownMaterializationRow[]
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

      return {
        snapshotsCreated: input.summaryRows.length,
        breakdownsCreated: input.dailyRows.length,
      }
    })
  }

  async upsertAvailability(input: SaleKpiAvailabilityUpdate): Promise<void> {
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

  async getSummaryRows(input: { clientId: string; period: KpiPeriod }): Promise<SaleKpiSnapshotMaterializationRow[]> {
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
          code: 'sales.summary',
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

  async getDailyRows(input: { clientId: string; period: KpiPeriod }): Promise<SaleKpiBreakdownMaterializationRow[]> {
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
          code: 'sales.daily',
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

  async getSaleFactRows(input: { clientId: string; period: KpiPeriod; branchId?: number; sellerId?: number }): Promise<SaleFactRecord[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.period.from)
    const to = KpiPeriod.toDatabaseDate(input.period.to)

    return prisma.saleFact.findMany({
      where: {
        clientId: input.clientId,
        saleDate: {
          gte: from,
          lte: to,
        },
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
      },
      orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        saleDate: true,
        saleDatetime: true,
        sellerId: true,
        sellerName: true,
        statusNormalized: true,
        channel: true,
        hasLinkedBudget: true,
        valueAmount: true,
      },
    })
  }

  async getDrilldownRows(input: {
    clientId: string
    period: KpiPeriod
    branchId?: number
    sellerId?: number
  }): Promise<SaleKpiDrilldownFactRow[]> {
    const prisma = this.prisma as any
    const from = KpiPeriod.toDatabaseDate(input.period.from)
    const to = KpiPeriod.toDatabaseDate(input.period.to)

    const rows = await prisma.saleFact.findMany({
      where: {
        clientId: input.clientId,
        saleDate: {
          gte: from,
          lte: to,
        },
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
      },
      orderBy: [{ saleDate: 'desc' }, { saleDatetime: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        clientId: true,
        sourceTable: true,
        sourceRecordId: true,
        branchName: true,
        branchId: true,
        sellerId: true,
        sellerName: true,
        saleDate: true,
        saleDatetime: true,
        statusNormalized: true,
        channel: true,
        hasLinkedBudget: true,
        linkedBudgetSourceRecordId: true,
        customerName: true,
        cpfCnpj: true,
        valueAmount: true,
        sequential: true,
        invoiceSerie: true,
        invoiceNumeric: true,
        listDavsId: true,
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
        saleDate: Date | string
        saleDatetime: Date | string
        statusNormalized: string
        channel: string | null
        hasLinkedBudget: boolean
        linkedBudgetSourceRecordId: number | null
        customerName: string
        cpfCnpj: string | null
        valueAmount: { toString(): string }
        sequential: bigint | number | null
        invoiceSerie: bigint | number | null
        invoiceNumeric: bigint | number | null
        listDavsId: string | null
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
        saleDate: this.toDateKey(row.saleDate),
        saleDatetime: this.toTimestampText(row.saleDatetime),
        statusNormalized: row.statusNormalized,
        channel: row.channel,
        hasLinkedBudget: row.hasLinkedBudget,
        linkedBudgetSourceRecordId: row.linkedBudgetSourceRecordId,
        customerName: row.customerName,
        cpfCnpj: row.cpfCnpj,
        valueAmount: row.valueAmount.toString(),
        sequential: row.sequential,
        invoiceSerie: row.invoiceSerie,
        invoiceNumeric: row.invoiceNumeric,
        listDavsId: row.listDavsId,
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
  imports: [PrismaModule, AuthModule, NormalizationModule, CompaniesModule],
  providers: [
    PrismaBudgetKpiRepository,
    PrismaBudgetFollowUpDkwDispatchRepository,
    PrismaSaleKpiRepository,
    PrismaCallKpiRepository,
    PrismaWhatsAppKpiRepository,
    FetchBudgetFollowUpDkwWebhookClient,
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
      useFactory: (repository: PrismaBudgetKpiRepository, branchScopeService: BranchScopeService) =>
        new BudgetKpiQueryService(repository, branchScopeService),
      inject: [PrismaBudgetKpiRepository, BranchScopeService],
    },
    {
      provide: BudgetFollowUpDkwDispatchService,
      useFactory: (
        repository: PrismaBudgetFollowUpDkwDispatchRepository,
        webhookClient: FetchBudgetFollowUpDkwWebhookClient,
        branchScopeService: BranchScopeService,
      ) => new BudgetFollowUpDkwDispatchService(repository, webhookClient, branchScopeService),
      inject: [PrismaBudgetFollowUpDkwDispatchRepository, FetchBudgetFollowUpDkwWebhookClient, BranchScopeService],
    },
    {
      provide: SaleKpiAvailabilityService,
      useFactory: (repository: PrismaSaleKpiRepository) => new SaleKpiAvailabilityService(repository),
      inject: [PrismaSaleKpiRepository],
    },
    {
      provide: SaleKpiRefreshService,
      useFactory: (
        repository: PrismaSaleKpiRepository,
        availabilityService: SaleKpiAvailabilityService,
        saleNormalizationService: SaleNormalizationService,
      ) => new SaleKpiRefreshService(repository, availabilityService, saleNormalizationService),
      inject: [PrismaSaleKpiRepository, SaleKpiAvailabilityService, SaleNormalizationService],
    },
    {
      provide: SaleKpiQueryService,
      useFactory: (repository: PrismaSaleKpiRepository, branchScopeService: BranchScopeService) =>
        new SaleKpiQueryService(repository, branchScopeService),
      inject: [PrismaSaleKpiRepository, BranchScopeService],
    },
    {
      provide: CallKpiAvailabilityService,
      useFactory: (repository: PrismaCallKpiRepository) => new CallKpiAvailabilityService(repository),
      inject: [PrismaCallKpiRepository],
    },
    {
      provide: CallKpiRefreshService,
      useFactory: (
        repository: PrismaCallKpiRepository,
        availabilityService: CallKpiAvailabilityService,
        callNormalizationService: CallNormalizationService,
      ) => new CallKpiRefreshService(repository, availabilityService, callNormalizationService),
      inject: [PrismaCallKpiRepository, CallKpiAvailabilityService, CallNormalizationService],
    },
    {
      provide: CallKpiQueryService,
      useFactory: (repository: PrismaCallKpiRepository, branchScopeService: BranchScopeService) =>
        new CallKpiQueryService(repository, branchScopeService),
      inject: [PrismaCallKpiRepository, BranchScopeService],
    },
    {
      provide: WhatsAppKpiQueryService,
      useFactory: (repository: PrismaWhatsAppKpiRepository, branchScopeService: BranchScopeService) =>
        new WhatsAppKpiQueryService(repository, branchScopeService),
      inject: [PrismaWhatsAppKpiRepository, BranchScopeService],
    },
  ],
  controllers: [KpiController, SalesKpiController, CallKpiController, WhatsAppKpiController],
  exports: [
    BudgetKpiAvailabilityService,
    BudgetKpiRefreshService,
    BudgetKpiQueryService,
    BudgetFollowUpDkwDispatchService,
    SaleKpiAvailabilityService,
    SaleKpiRefreshService,
    SaleKpiQueryService,
    CallKpiAvailabilityService,
    CallKpiRefreshService,
    CallKpiQueryService,
    WhatsAppKpiQueryService,
  ],
})
export class KpiModule {}
