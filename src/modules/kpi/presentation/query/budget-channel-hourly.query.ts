import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetChannelHourlyQuery = BudgetFactFiltersQuery

export function parseBudgetChannelHourlyQuery(query: Record<string, unknown>): BudgetChannelHourlyQuery {
  return parseBudgetFactFiltersQuery(query, 'Invalid budget channel hourly query params')
}
