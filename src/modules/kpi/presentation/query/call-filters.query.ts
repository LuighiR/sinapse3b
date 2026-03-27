import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'
import { numericIdSchema } from './budget-filters.query'

export type CallBasePeriodQuery = {
  from: string
  to: string
}

export type CallFactFiltersQuery = CallBasePeriodQuery & {
  sellerId?: number
}

const callBasePeriodSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

const callFactFiltersSchema = callBasePeriodSchema.extend({
  sellerId: numericIdSchema.optional(),
})

export function parseCallFactFiltersQuery(
  query: Record<string, unknown>,
  errorMessage: string,
): CallFactFiltersQuery {
  const parsed = callFactFiltersSchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

function isValidPeriod(input: CallBasePeriodQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
