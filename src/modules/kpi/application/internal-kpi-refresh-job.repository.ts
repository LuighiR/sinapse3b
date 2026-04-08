export type InternalKpiRefreshJobStepName = 'budgets' | 'sales' | 'calls'
export type InternalKpiRefreshJobStepStatus = 'success' | 'failed'
export type InternalKpiRefreshJobOverallStatus = 'success' | 'partial_success' | 'failed'
export type InternalKpiRefreshJobPersistedStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'

export type InternalKpiRefreshJobStepResult = {
  job: InternalKpiRefreshJobStepName
  status: InternalKpiRefreshJobStepStatus
  startedAt: string
  finishedAt: string
  error?: string
}

export type InternalKpiRefreshJobResultsJson = {
  overallStatus: InternalKpiRefreshJobOverallStatus
  results: InternalKpiRefreshJobStepResult[]
}

export type InternalKpiRefreshJobRecord = {
  id: bigint
  tenantId: string
  clientId: string
  slug: string
  triggerType: string
  requestedFrom: Date
  requestedTo: Date
  status: InternalKpiRefreshJobPersistedStatus
  requestedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
  errorMessage: string | null
  resultsJson: InternalKpiRefreshJobResultsJson | null
}

export type CreateInternalKpiRefreshJobInput = {
  tenantId: string
  clientId: string
  slug: string
  triggerType: 'api'
  requestedFrom: Date
  requestedTo: Date
  status: 'PENDING'
}

export type MarkInternalKpiRefreshJobRunningInput = {
  jobId: bigint
  startedAt: Date
}

export type CompleteInternalKpiRefreshJobInput = {
  jobId: bigint
  status: Extract<InternalKpiRefreshJobPersistedStatus, 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'>
  finishedAt: Date
  errorMessage: string | null
  resultsJson: InternalKpiRefreshJobResultsJson
}

export abstract class InternalKpiRefreshJobRepository {
  abstract create(input: CreateInternalKpiRefreshJobInput): Promise<{ id: bigint }>
  abstract findById(jobId: bigint): Promise<InternalKpiRefreshJobRecord | null>
  abstract markRunning(input: MarkInternalKpiRefreshJobRunningInput): Promise<void>
  abstract complete(input: CompleteInternalKpiRefreshJobInput): Promise<void>
}
