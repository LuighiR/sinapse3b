import { Injectable, UnauthorizedException } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import { BudgetKpiRefreshService } from './budget-kpi-refresh.service'
import { CallKpiRefreshService } from './call-kpi-refresh.service'
import { InternalKpiJobTenantResolverService } from './internal-kpi-job-tenant-resolver.service'
import { SaleKpiRefreshService } from './sale-kpi-refresh.service'

type RefreshableKpiService = {
  refresh(input: { clientId: string; from: string; to: string }): Promise<unknown>
}

export type InternalKpiRefreshJobInput = {
  jobKey: string
  slug: string
  from: string
  to: string
}

export type InternalKpiRefreshJobStepName = 'budgets' | 'sales' | 'calls'
export type InternalKpiRefreshJobStepStatus = 'success' | 'failed'
export type InternalKpiRefreshJobStatus = 'success' | 'partial_success' | 'failed'

export type InternalKpiRefreshJobStepResult = {
  job: InternalKpiRefreshJobStepName
  status: InternalKpiRefreshJobStepStatus
  startedAt: string
  finishedAt: string
  error?: string
}

export type InternalKpiRefreshJobResult = {
  slug: string
  clientId: string
  from: string
  to: string
  overallStatus: InternalKpiRefreshJobStatus
  results: InternalKpiRefreshJobStepResult[]
}

@Injectable()
export class InternalKpiRefreshJobService {
  constructor(
    private readonly tenantResolver: InternalKpiJobTenantResolverService,
    private readonly budgetRefreshService: BudgetKpiRefreshService,
    private readonly saleRefreshService: SaleKpiRefreshService,
    private readonly callRefreshService: CallKpiRefreshService,
  ) {}

  async run(input: InternalKpiRefreshJobInput): Promise<InternalKpiRefreshJobResult> {
    this.assertValidJobKey(input.jobKey)

    const tenant = await this.tenantResolver.resolveBySlug(input.slug)
    console.log(
      `internal KPI refresh job started slug=${tenant.slug} clientId=${tenant.clientId} from=${input.from} to=${input.to}`,
    )

    const results = [
      await this.runRefreshStep('budgets', this.budgetRefreshService, tenant.clientId, input.from, input.to),
      await this.runRefreshStep('sales', this.saleRefreshService, tenant.clientId, input.from, input.to),
      await this.runRefreshStep('calls', this.callRefreshService, tenant.clientId, input.from, input.to),
    ]

    const overallStatus = this.resolveOverallStatus(results)
    console.log(`internal KPI refresh job finished with ${overallStatus} slug=${tenant.slug} clientId=${tenant.clientId}`)

    return {
      slug: tenant.slug,
      clientId: tenant.clientId,
      from: input.from,
      to: input.to,
      overallStatus,
      results,
    }
  }

  private assertValidJobKey(jobKey: string) {
    const expectedJobKey = loadEnv(process.env).INTERNAL_JOB_KEY

    if (jobKey.trim() === '' || jobKey !== expectedJobKey) {
      throw new UnauthorizedException('Invalid job key')
    }
  }

  private async runRefreshStep(
    job: InternalKpiRefreshJobStepName,
    service: RefreshableKpiService,
    clientId: string,
    from: string,
    to: string,
  ): Promise<InternalKpiRefreshJobStepResult> {
    const startedAt = new Date()
    console.log(`internal KPI refresh step started job=${job} clientId=${clientId} from=${from} to=${to}`)

    try {
      await service.refresh({
        clientId,
        from,
        to,
      })

      const finishedAt = new Date()
      console.log(`internal KPI refresh step finished job=${job} status=success clientId=${clientId}`)
      return {
        job,
        status: 'success',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      }
    } catch (error) {
      const finishedAt = new Date()
      const message = error instanceof Error ? error.message : String(error)
      console.log(`internal KPI refresh step failed job=${job} clientId=${clientId} error=${message}`)
      return {
        job,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        error: message,
      }
    }
  }

  private resolveOverallStatus(results: InternalKpiRefreshJobStepResult[]): InternalKpiRefreshJobStatus {
    const successCount = results.filter((result) => result.status === 'success').length

    if (successCount === results.length) {
      return 'success'
    }

    if (successCount === 0) {
      return 'failed'
    }

    return 'partial_success'
  }
}
