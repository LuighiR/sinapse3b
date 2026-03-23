import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type BudgetDrilldownQuery = {
  from: string
  to: string
  sellerId?: number
  branchId?: number
  branchName?: string
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

const budgetDrilldownQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  sellerId: numericIdSchema.optional(),
  branchId: numericIdSchema.optional(),
  branchName: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
})

export function parseBudgetDrilldownQuery(query: Record<string, unknown>): BudgetDrilldownQuery {
  const parsed = budgetDrilldownQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
    branchId: query.branchId,
    branchName: query.branchName,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid budget drilldown query params')
  }

  try {
    KpiPeriod.between(parsed.data)
  } catch {
    throw new BadRequestException('Invalid budget drilldown query params')
  }

  return parsed.data
}
