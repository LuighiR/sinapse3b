import { z } from 'zod'
import {
  optionalSlugSchema,
  budgetFollowUpSummaryQuerySchema,
  parseBudgetFollowUpQuery,
} from './budget-follow-up-common.query'

export const budgetFollowUpDkwDispatchQuerySchema = budgetFollowUpSummaryQuerySchema.extend({
  slug: optionalSlugSchema,
})

export type BudgetFollowUpDkwDispatchQuery = z.infer<typeof budgetFollowUpDkwDispatchQuerySchema>

export function parseBudgetFollowUpDkwDispatchQuery(
  query: Record<string, unknown>,
): BudgetFollowUpDkwDispatchQuery {
  return parseBudgetFollowUpQuery(
    query,
    'Invalid budget follow-up DKW dispatch query params',
    budgetFollowUpDkwDispatchQuerySchema,
  )
}
