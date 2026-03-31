import {
  budgetFollowUpSummaryQuerySchema,
  parseBudgetFollowUpQuery,
  type BudgetFollowUpSummaryQuery,
} from './budget-follow-up-common.query'

export function parseBudgetFollowUpSummaryQuery(query: Record<string, unknown>): BudgetFollowUpSummaryQuery {
  return parseBudgetFollowUpQuery(query, 'Invalid budget follow-up summary query params', budgetFollowUpSummaryQuerySchema)
}
