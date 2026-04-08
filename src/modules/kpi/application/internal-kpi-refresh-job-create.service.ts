import { Injectable } from '@nestjs/common'
import { KpiPeriod } from '../domain/kpi-period'
import { InternalKpiJobKeyAuthorizerService } from './internal-kpi-job-key-authorizer.service'
import { InternalKpiJobTenantResolverService } from './internal-kpi-job-tenant-resolver.service'
import { InternalKpiRefreshJobExecuteService } from './internal-kpi-refresh-job-execute.service'
import { InternalKpiRefreshJobRepository } from './internal-kpi-refresh-job.repository'

export type InternalKpiRefreshJobCreateInput = {
  jobKey: string
  slug: string
  from: string
  to: string
}

export type InternalKpiRefreshJobAcceptedResponse = {
  status: 'accepted'
  message: 'task initiated'
  jobId: string
}

@Injectable()
export class InternalKpiRefreshJobCreateService {
  constructor(
    private readonly jobKeyAuthorizer: InternalKpiJobKeyAuthorizerService,
    private readonly tenantResolver: InternalKpiJobTenantResolverService,
    private readonly repository: InternalKpiRefreshJobRepository,
    private readonly executeService: InternalKpiRefreshJobExecuteService,
  ) {}

  async create(input: InternalKpiRefreshJobCreateInput): Promise<InternalKpiRefreshJobAcceptedResponse> {
    this.jobKeyAuthorizer.assertValid(input.jobKey)

    const tenant = await this.tenantResolver.resolveBySlug(input.slug)
    const period = KpiPeriod.between({
      from: input.from,
      to: input.to,
    })
    const job = await this.repository.create({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      slug: tenant.slug,
      triggerType: 'api',
      requestedFrom: KpiPeriod.toDatabaseDate(period.from),
      requestedTo: KpiPeriod.toDatabaseDate(period.to),
      status: 'PENDING',
    })

    console.log(
      `internal KPI refresh job accepted jobId=${job.id} slug=${tenant.slug} clientId=${tenant.clientId} from=${input.from} to=${input.to}`,
    )

    this.scheduleExecution(job.id, async () => this.executeService.execute(job.id))

    return {
      status: 'accepted',
      message: 'task initiated',
      jobId: job.id.toString(),
    }
  }

  protected scheduleExecution(jobId: bigint, task: () => Promise<void>) {
    queueMicrotask(() => {
      console.log(`internal KPI refresh job background dispatched jobId=${jobId}`)
      void task().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`internal KPI refresh job background dispatch failed jobId=${jobId} error=${message}`)
      })
    })
  }
}
