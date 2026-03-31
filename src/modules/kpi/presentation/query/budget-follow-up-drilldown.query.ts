import {
  budgetFollowUpDrilldownQuerySchema,
  parseBudgetFollowUpQuery,
  type BudgetFollowUpDrilldownQuery as BudgetFollowUpDrilldownQueryInput,
} from './budget-follow-up-common.query'

export type BudgetFollowUpDrilldownQuery = BudgetFollowUpDrilldownQueryInput

export function parseBudgetFollowUpDrilldownQuery(
  query: Record<string, unknown>,
): BudgetFollowUpDrilldownQuery {
  return parseBudgetFollowUpQuery(
    query,
    'Invalid budget follow-up drilldown query params',
    budgetFollowUpDrilldownQuerySchema,
  )
}
