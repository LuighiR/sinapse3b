import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import {
  MessagingContactsBackfillResult,
  MessagingContactsBackfillService,
} from './messaging-contacts-backfill.service'

export type MessagingContactsBackfillJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export type MessagingContactsBackfillJobSnapshot = {
  jobId: string
  clientId: string
  from: string | null
  to: string | null
  status: MessagingContactsBackfillJobStatus
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  result: MessagingContactsBackfillResult | null
}

export type MessagingContactsBackfillAcceptedResponse = {
  status: 'accepted'
  message: 'task initiated'
  jobId: string
}

type MessagingContactsBackfillJobRecord = MessagingContactsBackfillJobSnapshot & {
  period?: KpiPeriod
}

@Injectable()
export class MessagingContactsBackfillJobService {
  private readonly jobs = new Map<string, MessagingContactsBackfillJobRecord>()
  private readonly runningClientIds = new Set<string>()

  constructor(private readonly backfillService: MessagingContactsBackfillService) {}

  start(input: { clientId: string; period?: KpiPeriod }): MessagingContactsBackfillAcceptedResponse {
    if (this.runningClientIds.has(input.clientId)) {
      throw new ConflictException('A contacts backfill job is already running for this client')
    }

    const jobId = randomUUID()
    const from = input.period == null ? null : KpiPeriod.formatDateKey(input.period.from)
    const to = input.period == null ? null : KpiPeriod.formatDateKey(input.period.to)

    this.jobs.set(jobId, {
      jobId,
      clientId: input.clientId,
      from,
      to,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      result: null,
      period: input.period,
    })

    console.log(
      `[messaging-contacts-backfill] job accepted jobId=${jobId} clientId=${input.clientId} from=${from ?? 'ALL'} to=${to ?? 'ALL'}`,
    )

    this.scheduleExecution(jobId)

    return {
      status: 'accepted',
      message: 'task initiated',
      jobId,
    }
  }

  getStatus(jobId: string): MessagingContactsBackfillJobSnapshot {
    const job = this.jobs.get(jobId)

    if (job == null) {
      throw new NotFoundException('Contacts backfill job not found')
    }

    return { ...job }
  }

  protected scheduleExecution(jobId: string): void {
    queueMicrotask(() => {
      console.log(`[messaging-contacts-backfill] job background dispatched jobId=${jobId}`)
      void this.execute(jobId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.log(
          `[messaging-contacts-backfill] job background dispatch failed jobId=${jobId} error=${message}`,
        )
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
      const result = await this.backfillService.backfillClient({
        clientId: job.clientId,
        period: job.period,
      })

      job.status = 'COMPLETED'
      job.result = result
      job.finishedAt = new Date().toISOString()

      console.log(
        `[messaging-contacts-backfill] job completed jobId=${jobId} contactsWritten=${result.contactsWritten} sessionsLinked=${result.sessionsLinked}`,
      )
    } catch (error: unknown) {
      job.status = 'FAILED'
      job.errorMessage = error instanceof Error ? error.message : String(error)
      job.finishedAt = new Date().toISOString()

      console.log(`[messaging-contacts-backfill] job failed jobId=${jobId} error=${job.errorMessage}`)
    } finally {
      this.runningClientIds.delete(job.clientId)
    }
  }
}
