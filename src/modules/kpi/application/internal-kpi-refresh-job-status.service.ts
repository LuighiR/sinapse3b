import { Injectable, NotFoundException } from '@nestjs/common'
import { InternalKpiJobKeyAuthorizerService } from './internal-kpi-job-key-authorizer.service'
import { InternalKpiRefreshJobRepository } from './internal-kpi-refresh-job.repository'

export type InternalKpiRefreshJobStatusInput = {
  jobKey: string
  jobId: string
}

export type InternalKpiRefreshJobStatusResponse = {
  jobId: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
  slug: string
  tenantId: string
  clientId: string
  from: string
  to: string
  triggerType: string
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  results: unknown | null
}

@Injectable()
export class InternalKpiRefreshJobStatusService {
  constructor(
    private readonly jobKeyAuthorizer: InternalKpiJobKeyAuthorizerService,
    private readonly repository: InternalKpiRefreshJobRepository,
  ) {}

  async getStatus(input: InternalKpiRefreshJobStatusInput): Promise<InternalKpiRefreshJobStatusResponse> {
    this.jobKeyAuthorizer.assertValid(input.jobKey)

    const job = await this.repository.findById(BigInt(input.jobId))

    if (job === null) {
      throw new NotFoundException('Refresh job not found')
    }

    return {
      jobId: job.id.toString(),
      status: job.status,
      slug: job.slug,
      tenantId: job.tenantId,
      clientId: job.clientId,
      from: this.toDateKey(job.requestedFrom),
      to: this.toDateKey(job.requestedTo),
      triggerType: job.triggerType,
      requestedAt: job.requestedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      errorMessage: job.errorMessage,
      results: job.status === 'PENDING' || job.status === 'RUNNING' ? null : job.resultsJson,
    }
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10)
  }
}
