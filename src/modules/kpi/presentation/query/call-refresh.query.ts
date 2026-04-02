import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type CallRefreshQuery = {
  from: string
  to: string
}

const callRefreshSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

export function parseCallRefreshQuery(query: Record<string, unknown>): CallRefreshQuery {
  if (query.branchId !== undefined || query.sellerId !== undefined) {
    throw new BadRequestException('Invalid call refresh query params')
  }

  const parsed = callRefreshSchema.safeParse({
    from: query.from,
    to: query.to,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException('Invalid call refresh query params')
  }

  return parsed.data
}

function isValidPeriod(input: CallRefreshQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
