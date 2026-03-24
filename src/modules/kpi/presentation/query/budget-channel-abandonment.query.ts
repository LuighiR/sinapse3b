import { parseBudgetFactFiltersQuery, type BudgetFactFiltersQuery } from './budget-filters.query'

export type BudgetChannelAbandonmentQuery = Omit<BudgetFactFiltersQuery, 'status'>

export function parseBudgetChannelAbandonmentQuery(
  query: Record<string, unknown>,
): BudgetChannelAbandonmentQuery {
  const parsed = parseBudgetFactFiltersQuery(query, 'Invalid budget channel abandonment query params')
  const { status: _status, ...rest } = parsed

  return rest
}
