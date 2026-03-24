import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetDailyQuery = BudgetFactFiltersQuery

export function parseBudgetDailyQuery(query: Record<string, unknown>): BudgetDailyQuery {
  return parseBudgetFactFiltersQuery(query, 'Invalid budget daily query params')
}
