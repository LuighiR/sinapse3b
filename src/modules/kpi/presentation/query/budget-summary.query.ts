import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetSummaryQuery = BudgetFactFiltersQuery

export function parseBudgetSummaryQuery(query: Record<string, unknown>): BudgetSummaryQuery {
  return parseBudgetFactFiltersQuery(query, 'Invalid budget summary query params')
}
