import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type InternalKpiRefreshJobQuery = {
  slug: string
  from: string
  to: string
}

const internalKpiRefreshJobSchema = z.object({
  slug: z.string().trim().min(1),
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

const allowedKeys = new Set(['slug', 'from', 'to'])

export function parseInternalKpiRefreshJobQuery(query: Record<string, unknown>): InternalKpiRefreshJobQuery {
  if (Object.keys(query).some((key) => !allowedKeys.has(key))) {
    throw new BadRequestException('Invalid internal KPI refresh job query params')
  }

  const parsed = internalKpiRefreshJobSchema.safeParse({
    slug: query.slug,
    from: query.from,
    to: query.to,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException('Invalid internal KPI refresh job query params')
  }

  return parsed.data
}

function isValidPeriod(input: Pick<InternalKpiRefreshJobQuery, 'from' | 'to'>): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
