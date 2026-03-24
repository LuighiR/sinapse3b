import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetHourlyQuery = BudgetFactFiltersQuery

export function parseBudgetHourlyQuery(query: Record<string, unknown>): BudgetHourlyQuery {
  return parseBudgetFactFiltersQuery(query, 'Invalid budget hourly query params')
}
