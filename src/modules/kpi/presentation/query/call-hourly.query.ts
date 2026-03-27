import { parseCallFactFiltersQuery, type CallFactFiltersQuery } from './call-filters.query'

export type CallHourlyQuery = CallFactFiltersQuery

export function parseCallHourlyQuery(query: Record<string, unknown>): CallHourlyQuery {
  return parseCallFactFiltersQuery(query, 'Invalid call hourly query params')
}
