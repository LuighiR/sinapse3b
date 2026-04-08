import { Injectable } from '@nestjs/common'
import { BudgetKpiRefreshService } from './budget-kpi-refresh.service'
import { CallKpiRefreshService } from './call-kpi-refresh.service'
import {
  InternalKpiRefreshJobOverallStatus,
  InternalKpiRefreshJobPersistedStatus,
  InternalKpiRefreshJobRepository,
  InternalKpiRefreshJobResultsJson,
  InternalKpiRefreshJobStepName,
  InternalKpiRefreshJobStepResult,
} from './internal-kpi-refresh-job.repository'
import { SaleKpiRefreshService } from './sale-kpi-refresh.service'

type RefreshableKpiService = {
  refresh(input: { clientId: string; from: string; to: string }): Promise<unknown>
}

@Injectable()
export class InternalKpiRefreshJobExecuteService {
  constructor(
    private readonly repository: InternalKpiRefreshJobRepository,
    private readonly budgetRefreshService: BudgetKpiRefreshService,
    private readonly saleRefreshService: SaleKpiRefreshService,
    private readonly callRefreshService: CallKpiRefreshService,
  ) {}

  async execute(jobId: bigint): Promise<void> {
    const job = await this.repository.findById(jobId)

    if (job === null) {
      console.log(`internal KPI refresh background execution skipped jobId=${jobId} reason=missing_job`)
      return
    }

    const startedAt = new Date()
    console.log(
      `internal KPI refresh background execution started jobId=${job.id} slug=${job.slug} clientId=${job.clientId}`,
    )
    await this.repository.markRunning({
      jobId,
      startedAt,
    })

    const from = this.toDateKey(job.requestedFrom)
    const to = this.toDateKey(job.requestedTo)
    const results = [
      await this.runRefreshStep(job.id, 'budgets', this.budgetRefreshService, job.clientId, from, to),
      await this.runRefreshStep(job.id, 'sales', this.saleRefreshService, job.clientId, from, to),
      await this.runRefreshStep(job.id, 'calls', this.callRefreshService, job.clientId, from, to),
    ]
    const overallStatus = this.resolveOverallStatus(results)
    const persistedStatus = this.toPersistedStatus(overallStatus)
    const finishedAt = new Date()
    const errorMessage = this.buildErrorMessage(results)
    const resultsJson: InternalKpiRefreshJobResultsJson = {
      overallStatus,
      results,
    }

    await this.repository.complete({
      jobId,
      status: persistedStatus,
      finishedAt,
      errorMessage,
      resultsJson,
    })

    console.log(
      `internal KPI refresh background execution finished jobId=${job.id} status=${persistedStatus} slug=${job.slug} clientId=${job.clientId}`,
    )
  }

  private async runRefreshStep(
    jobId: bigint,
    stepName: InternalKpiRefreshJobStepName,
    service: RefreshableKpiService,
    clientId: string,
    from: string,
    to: string,
  ): Promise<InternalKpiRefreshJobStepResult> {
    const startedAt = new Date()
    console.log(
      `internal KPI refresh step started jobId=${jobId} job=${stepName} clientId=${clientId} from=${from} to=${to}`,
    )

    try {
      await service.refresh({
        clientId,
        from,
        to,
      })

      const finishedAt = new Date()
      console.log(`internal KPI refresh step finished jobId=${jobId} job=${stepName} status=success clientId=${clientId}`)
      return {
        job: stepName,
        status: 'success',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      }
    } catch (error) {
      const finishedAt = new Date()
      const message = error instanceof Error ? error.message : String(error)
      console.log(`internal KPI refresh step failed jobId=${jobId} job=${stepName} clientId=${clientId} error=${message}`)
      return {
        job: stepName,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        error: message,
      }
    }
  }

  private resolveOverallStatus(results: InternalKpiRefreshJobStepResult[]): InternalKpiRefreshJobOverallStatus {
    const successCount = results.filter((result) => result.status === 'success').length

    if (successCount === results.length) {
      return 'success'
    }

    if (successCount === 0) {
      return 'failed'
    }

    return 'partial_success'
  }

  private toPersistedStatus(status: InternalKpiRefreshJobOverallStatus): Extract<
    InternalKpiRefreshJobPersistedStatus,
    'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
  > {
    switch (status) {
      case 'success':
        return 'SUCCESS'
      case 'partial_success':
        return 'PARTIAL_SUCCESS'
      default:
        return 'FAILED'
    }
  }

  private buildErrorMessage(results: InternalKpiRefreshJobStepResult[]): string | null {
    const failures = results
      .filter((result) => result.status === 'failed' && typeof result.error === 'string')
      .map((result) => `${result.job}: ${result.error}`)

    if (failures.length === 0) {
      return null
    }

    return failures.join('; ')
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10)
  }
}
