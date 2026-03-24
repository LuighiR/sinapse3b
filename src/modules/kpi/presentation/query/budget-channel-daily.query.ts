import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetChannelDailyQuery = BudgetFactFiltersQuery

export function parseBudgetChannelDailyQuery(query: Record<string, unknown>): BudgetChannelDailyQuery {
  return parseBudgetFactFiltersQuery(query, 'Invalid budget channel daily query params')
}
