import { BadRequestException } from '@nestjs/common'
import { BranchScopeService } from '../../companies/application/branch-scope.service'
import { KpiPeriod } from '../domain/kpi-period'
import {
  classifyBudgetFollowUpRecord,
  followUpStatus,
  followUpWindow,
} from './budget-follow-up-classifier'

export type BudgetFollowUpDkwDispatchInput = {
  clientId: string
  from: string | Date
  to: string | Date
  referenceAt: string | Date
  sellerId?: number
  branchId?: number
  orderType?: string
}

export type BudgetFollowUpDkwDispatchStatus = 'completed' | 'aborted_after_consecutive_errors'

export type BudgetFollowUpDkwDispatchResponse = {
  period: {
    from: string
    to: string
    key: string
  }
  referenceAt: string
  status: BudgetFollowUpDkwDispatchStatus
}

export type BudgetFollowUpDkwDispatchCandidate = {
  rawBudgetId: number
  clientId: string
  sourceRecordId: number
  branchId: number | null
  sellerId: number
  statusNormalized: string
  budgetDatetime: Date | string
  closingDate: Date | string | null
  cancellationDate: Date | string | null
  cancelationTime: string | null
  payloadJson: Record<string, unknown> | null
  customerName: string
  email: string | null
  cellPhone: string | null
  phone: string | null
  valueAmount: string
  davId: string
  sellerName: string
  openingDatetime: string
  sentDkwAt: Date | string | null
  dkwWebhook: string | null
}

export type BudgetFollowUpDkwWebhookPayload = {
  name: string
  email?: string
  phone: string
  valor_orcamento: string
  codigo_dav: string
  vendedor: string
  data_hora_abertura: string
  mensagem?: string
}

export type BudgetFollowUpDkwDispatchRepository = {
  listDispatchCandidates(input: {
    clientId: string
    period: KpiPeriod
    sellerId?: number
    branchId?: number
    orderType?: string
  }): Promise<BudgetFollowUpDkwDispatchCandidate[]>
  markAsSent(input: { rawBudgetId: number; sentAt: Date }): Promise<void>
}

export type BudgetFollowUpDkwWebhookClient = {
  sendLead(url: string, payload: BudgetFollowUpDkwWebhookPayload): Promise<void>
}

export class BudgetFollowUpDkwDispatchService {
  constructor(
    private readonly repository: BudgetFollowUpDkwDispatchRepository,
    private readonly webhookClient: BudgetFollowUpDkwWebhookClient,
    private readonly branchScopeService?: BranchScopeService,
    private readonly fallbackWebhookUrl?: string,
  ) {}

  async dispatch(input: BudgetFollowUpDkwDispatchInput): Promise<BudgetFollowUpDkwDispatchResponse> {
    const period = KpiPeriod.between({ from: input.from, to: input.to })
    const referenceAt = this.parseReferenceAt(input.referenceAt)

    if (input.branchId !== undefined && this.branchScopeService !== undefined) {
      await this.branchScopeService.assertBranchScope(input.clientId, input.branchId)
    }

    const rows = await this.repository.listDispatchCandidates({
      clientId: input.clientId,
      period,
      sellerId: input.sellerId,
      branchId: input.branchId,
      orderType: input.orderType,
    })

    console.log('[budget-follow-up-dkw-dispatch] start', {
      clientId: input.clientId,
      from: KpiPeriod.formatDateKey(period.from),
      to: KpiPeriod.formatDateKey(period.to),
      referenceAt: this.toReferenceAtText(input.referenceAt),
      sellerId: input.sellerId,
      branchId: input.branchId,
      orderType: input.orderType,
    })

    let consecutiveErrors = 0
    let status: BudgetFollowUpDkwDispatchStatus = 'completed'

    for (const row of rows) {
      if (row.sentDkwAt !== null) {
        console.log('[budget-follow-up-dkw-dispatch] skip already sent', {
          rawBudgetId: row.rawBudgetId,
        })
        continue
      }

      const classification = classifyBudgetFollowUpRecord(
        {
          statusNormalized: row.statusNormalized,
          budgetDatetime: row.budgetDatetime,
          closingDate: row.closingDate,
          cancellationDate: row.cancellationDate,
          cancelationTime: row.cancelationTime,
          payloadJson: row.payloadJson,
        },
        referenceAt,
      )

      if (classification === null) {
        continue
      }

      if (classification.window !== followUpWindow.after24h || classification.status !== followUpStatus.open) {
        continue
      }

      try {
        const webhookUrl = this.resolveWebhookUrl(row)
        const payload = this.toWebhookPayload(row)
        await this.webhookClient.sendLead(webhookUrl, payload)

        const sentAt = new Date()
        await this.repository.markAsSent({
          rawBudgetId: row.rawBudgetId,
          sentAt,
        })

        consecutiveErrors = 0
        console.log('[budget-follow-up-dkw-dispatch] sent', {
          rawBudgetId: row.rawBudgetId,
          sourceRecordId: row.sourceRecordId,
        })
      } catch (error) {
        consecutiveErrors += 1
        console.log('[budget-follow-up-dkw-dispatch] failed', {
          rawBudgetId: row.rawBudgetId,
          sourceRecordId: row.sourceRecordId,
          consecutiveErrors,
          error: error instanceof Error ? error.message : String(error),
        })

        if (consecutiveErrors >= 3) {
          status = 'aborted_after_consecutive_errors'
          console.log('[budget-follow-up-dkw-dispatch] abort threshold reached', {
            rawBudgetId: row.rawBudgetId,
          })
          break
        }
      }
    }

    console.log('[budget-follow-up-dkw-dispatch] finish', {
      clientId: input.clientId,
      status,
    })

    return {
      period: {
        from: KpiPeriod.formatDateKey(period.from),
        to: KpiPeriod.formatDateKey(period.to),
        key: period.key,
      },
      referenceAt: this.toReferenceAtText(input.referenceAt),
      status,
    }
  }

  private toWebhookPayload(row: BudgetFollowUpDkwDispatchCandidate): BudgetFollowUpDkwWebhookPayload {
    const resolvedPhone = this.firstNonBlank(row.cellPhone, row.phone) ?? 'Sem registro'
    const missingPhone = resolvedPhone === 'Sem registro'
    const email = this.normalizeOptionalText(row.email)

    return {
      name: row.customerName,
      ...(email === undefined ? {} : { email }),
      phone: resolvedPhone,
      valor_orcamento: this.formatCurrency(row.valueAmount),
      codigo_dav: row.davId,
      vendedor: row.sellerName,
      data_hora_abertura: this.formatOpeningDate(row.openingDatetime),
      ...(missingPhone ? { mensagem: 'Sem telefone registrado' } : {}),
    }
  }

  private resolveWebhookUrl(row: BudgetFollowUpDkwDispatchCandidate): string {
    const webhookUrl = this.firstNonBlank(
      row.dkwWebhook,
      this.fallbackWebhookUrl,
      process.env.BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL,
    )

    if (webhookUrl === undefined) {
      throw new Error('No DKW webhook URL configured')
    }

    return webhookUrl
  }

  private firstNonBlank(...values: Array<string | null | undefined>): string | undefined {
    for (const value of values) {
      const normalized = this.normalizeOptionalText(value)

      if (normalized !== undefined) {
        return normalized
      }
    }

    return undefined
  }

  private normalizeOptionalText(value: string | null | undefined): string | undefined {
    if (value == null) {
      return undefined
    }

    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }

  private toReferenceAtText(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : value
  }

  private parseReferenceAt(value: string | Date): Date {
    if (value instanceof Date) {
      return value
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      throw new BadRequestException('Invalid budget follow-up DKW dispatch query params')
    }

    const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)
      ? trimmed
      : /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?$/.test(trimmed)
        ? `${trimmed.replace(' ', 'T')}-03:00`
        : trimmed
    const parsed = new Date(normalized)

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid budget follow-up DKW dispatch query params')
    }

    return parsed
  }

  private formatCurrency(value: string): string {
    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed)) {
      return value
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed).replace(/\u00A0/g, ' ')
  }

  private formatOpeningDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)

    if (match === null) {
      return value
    }

    return `${match[3]}/${match[2]}/${match[1]}`
  }
}
