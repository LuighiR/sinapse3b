import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type BudgetStatusQuery = 'Cancelado' | 'Baixado' | 'Pendente'

export type BudgetBasePeriodQuery = {
  from: string
  to: string
}

export type BudgetFactFiltersQuery = BudgetBasePeriodQuery & {
  sellerId?: number
  status?: BudgetStatusQuery
  orderType?: string
}

export const numericIdSchema = z
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

const orderTypeSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const budgetBasePeriodSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

const budgetFactFiltersSchema = budgetBasePeriodSchema.extend({
  sellerId: numericIdSchema.optional(),
  status: z.enum(['Cancelado', 'Baixado', 'Pendente']).optional(),
  orderType: orderTypeSchema,
})

export function parseBudgetBasePeriodQuery(
  query: Record<string, unknown>,
  errorMessage: string,
): BudgetBasePeriodQuery {
  const parsed = budgetBasePeriodSchema.safeParse({
    from: query.from,
    to: query.to,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

export function parseBudgetFactFiltersQuery(
  query: Record<string, unknown>,
  errorMessage: string,
): BudgetFactFiltersQuery {
  const parsed = budgetFactFiltersSchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
    status: query.status,
    orderType: query.orderType,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

function isValidPeriod(input: BudgetBasePeriodQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
