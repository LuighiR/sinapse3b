import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type BudgetSummaryQuery = {
  from: string
  to: string
  sellerId?: number
}

const numericIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d+$/)
  .refine((value) => {
    try {
      return BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)
    } catch {
      return false
    }
  })
  .transform((value) => Number(value))

const budgetSummaryQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  sellerId: numericIdSchema.optional(),
})

export function parseBudgetSummaryQuery(query: Record<string, unknown>): BudgetSummaryQuery {
  const parsed = budgetSummaryQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid budget summary query params')
  }

  try {
    KpiPeriod.between(parsed.data)
  } catch {
    throw new BadRequestException('Invalid budget summary query params')
  }

  return parsed.data
}
