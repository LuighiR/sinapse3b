import { parseCallFactFiltersQuery, type CallFactFiltersQuery } from './call-filters.query'

export type CallHourlyComparisonQuery = CallFactFiltersQuery

export function parseCallHourlyComparisonQuery(query: Record<string, unknown>): CallHourlyComparisonQuery {
  return parseCallFactFiltersQuery(query, 'Invalid call hourly comparison query params')
}
