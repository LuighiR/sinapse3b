import { parseCallFactFiltersQuery, type CallBasePeriodQuery } from './call-filters.query'

export type CallFilterOptionsQuery = CallBasePeriodQuery & {
  branchId?: number
}

export function parseCallFilterOptionsQuery(query: Record<string, unknown>): CallFilterOptionsQuery {
  const parsed = parseCallFactFiltersQuery(query, 'Invalid call filter options query params')

  return {
    from: parsed.from,
    to: parsed.to,
    ...(parsed.branchId !== undefined ? { branchId: parsed.branchId } : {}),
  }
}
