import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { budgetPeriodCards, type BudgetPeriodCard } from '../../application/budget-period-classifier'
import { KpiPeriod } from '../../domain/kpi-period'
import { numericIdSchema } from './budget-filters.query'
import type { BudgetStatusQuery } from './budget-filters.query'

export type BudgetDrilldownQuery = {
  from: string
  to: string
  sellerId?: number
  status?: BudgetStatusQuery
  branchId?: number
  branchName?: string
  card?: BudgetPeriodCard
}

const budgetDrilldownQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  sellerId: numericIdSchema.optional(),
  status: z.enum(['Cancelado', 'Baixado', 'Pendente']).optional(),
  branchId: numericIdSchema.optional(),
  branchName: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  card: z.enum(budgetPeriodCards).optional(),
})

export function parseBudgetDrilldownQuery(query: Record<string, unknown>): BudgetDrilldownQuery {
  const parsed = budgetDrilldownQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
    status: query.status,
    branchId: query.branchId,
    branchName: query.branchName,
    card: query.card,
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
