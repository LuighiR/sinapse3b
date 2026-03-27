import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'
import { numericIdSchema } from './budget-filters.query'

export type BudgetFollowUpSummaryQuery = {
  from: string
  to: string
  referenceAt: string
  sellerId?: number
  orderType?: string
}

const orderTypeSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const followUpReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isValidReferenceAt(value), 'Invalid referenceAt')

const budgetFollowUpSummarySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  referenceAt: followUpReferenceSchema,
  sellerId: numericIdSchema.optional(),
  orderType: orderTypeSchema,
})

export function parseBudgetFollowUpSummaryQuery(query: Record<string, unknown>): BudgetFollowUpSummaryQuery {
  const parsed = budgetFollowUpSummarySchema.safeParse({
    from: query.from,
    to: query.to,
    referenceAt: query.referenceAt,
    sellerId: query.sellerId,
    orderType: query.orderType,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException('Invalid budget follow-up summary query params')
  }

  return parsed.data
}

function isValidPeriod(input: { from: string; to: string }): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}

function isValidReferenceAt(value: string): boolean {
  const normalized = normalizeReferenceAtText(value)
  const parsed = new Date(normalized)

  return !Number.isNaN(parsed.getTime())
}

function normalizeReferenceAtText(value: string): string {
  const trimmed = value.trim()

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }

  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
    return `${withSeconds.replace(' ', 'T')}-03:00`
  }

  return trimmed
}
