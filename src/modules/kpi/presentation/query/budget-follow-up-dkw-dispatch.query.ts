import {
  budgetFollowUpSummaryQuerySchema,
  parseBudgetFollowUpQuery,
  type BudgetFollowUpSummaryQuery,
} from './budget-follow-up-common.query'

export function parseBudgetFollowUpDkwDispatchQuery(
  query: Record<string, unknown>,
): BudgetFollowUpSummaryQuery {
  return parseBudgetFollowUpQuery(
    query,
    'Invalid budget follow-up DKW dispatch query params',
    budgetFollowUpSummaryQuerySchema,
  )
}
