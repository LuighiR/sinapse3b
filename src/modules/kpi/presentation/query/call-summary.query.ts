import { parseCallFactFiltersQuery, type CallFactFiltersQuery } from './call-filters.query'

export type CallSummaryQuery = CallFactFiltersQuery

export function parseCallSummaryQuery(query: Record<string, unknown>): CallSummaryQuery {
  return parseCallFactFiltersQuery(query, 'Invalid call summary query params')
}
