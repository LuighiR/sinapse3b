import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import {
  DkwMessagingMigrationResult,
  DkwMessagingMigrationService,
} from './dkw-messaging-migration.service'

export type DkwMessagingMigrationJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export type DkwMessagingMigrationJobSnapshot = {
  jobId: string
  clientId: string
  from: string
  to: string
  batchSize: number
  status: DkwMessagingMigrationJobStatus
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  result: DkwMessagingMigrationResult | null
}

export type DkwMessagingMigrationAcceptedResponse = {
  status: 'accepted'
  message: 'task initiated'
  jobId: string
}

type DkwMessagingMigrationJobRecord = DkwMessagingMigrationJobSnapshot & {
  period: KpiPeriod
}

@Injectable()
export class DkwMessagingMigrationJobService {
  private readonly jobs = new Map<string, DkwMessagingMigrationJobRecord>()
  private readonly runningClientIds = new Set<string>()

  constructor(private readonly migrationService: DkwMessagingMigrationService) {}

  start(input: {
    clientId: string
    period: KpiPeriod
    batchSize: number
  }): DkwMessagingMigrationAcceptedResponse {
    if (this.runningClientIds.has(input.clientId)) {
      throw new ConflictException('A DKW migration job is already running for this client')
    }

    const jobId = randomUUID()
    const from = KpiPeriod.formatDateKey(input.period.from)
    const to = KpiPeriod.formatDateKey(input.period.to)

    this.jobs.set(jobId, {
      jobId,
      clientId: input.clientId,
      from,
      to,
      batchSize: input.batchSize,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      result: null,
      period: input.period,
    })

    console.log(
      `[dkw-migrate] job accepted jobId=${jobId} clientId=${input.clientId} from=${from} to=${to}`,
    )

    this.scheduleExecution(jobId)

    return {
      status: 'accepted',
      message: 'task initiated',
      jobId,
    }
  }

  getStatus(jobId: string): DkwMessagingMigrationJobSnapshot {
    const job = this.jobs.get(jobId)

    if (job == null) {
      throw new NotFoundException('DKW migration job not found')
    }

    return this.toSnapshot(job)
  }

  protected scheduleExecution(jobId: string): void {
    queueMicrotask(() => {
      console.log(`[dkw-migrate] job background dispatched jobId=${jobId}`)
      void this.execute(jobId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`[dkw-migrate] job background dispatch failed jobId=${jobId} error=${message}`)
      })
    })
  }

  private async execute(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)

    if (job == null) {
      return
    }

    this.runningClientIds.add(job.clientId)
    job.status = 'RUNNING'
    job.startedAt = new Date().toISOString()

    try {
      const result = await this.migrationService.migrateClient({
        clientId: job.clientId,
        period: job.period,
        batchSize: job.batchSize,
      })

      job.status = 'COMPLETED'
      job.result = result
      job.finishedAt = new Date().toISOString()

      console.log(
        `[dkw-migrate] job completed jobId=${jobId} messagesWritten=${result.totals.messagesWritten}`,
      )
    } catch (error: unknown) {
      job.status = 'FAILED'
      job.errorMessage = error instanceof Error ? error.message : String(error)
      job.finishedAt = new Date().toISOString()

      console.log(`[dkw-migrate] job failed jobId=${jobId} error=${job.errorMessage}`)
    } finally {
      this.runningClientIds.delete(job.clientId)
    }
  }

  private toSnapshot(job: DkwMessagingMigrationJobRecord): DkwMessagingMigrationJobSnapshot {
    return {
      jobId: job.jobId,
      clientId: job.clientId,
      from: job.from,
      to: job.to,
      batchSize: job.batchSize,
      status: job.status,
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      errorMessage: job.errorMessage,
      result: job.result,
    }
  }
}
