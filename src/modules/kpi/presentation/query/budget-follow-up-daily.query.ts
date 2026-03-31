import {
  budgetFollowUpSummaryQuerySchema,
  parseBudgetFollowUpQuery,
  type BudgetFollowUpSummaryQuery,
} from './budget-follow-up-common.query'

export type BudgetFollowUpDailyQuery = BudgetFollowUpSummaryQuery

export function parseBudgetFollowUpDailyQuery(query: Record<string, unknown>): BudgetFollowUpDailyQuery {
  return parseBudgetFollowUpQuery(query, 'Invalid budget follow-up daily query params', budgetFollowUpSummaryQuerySchema)
}
