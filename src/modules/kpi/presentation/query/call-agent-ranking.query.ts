import { parseCallFactFiltersQuery, type CallFactFiltersQuery } from './call-filters.query'

export type CallAgentRankingQuery = CallFactFiltersQuery

export function parseCallAgentRankingQuery(query: Record<string, unknown>): CallAgentRankingQuery {
  return parseCallFactFiltersQuery(query, 'Invalid call agent ranking query params')
}
