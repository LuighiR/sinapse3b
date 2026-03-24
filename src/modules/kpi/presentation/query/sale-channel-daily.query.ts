import { parseSaleFactFiltersQuery, type SaleFactFiltersQuery } from './sale-filters.query'

export type SaleChannelDailyQuery = SaleFactFiltersQuery

export function parseSaleChannelDailyQuery(query: Record<string, unknown>): SaleChannelDailyQuery {
  return parseSaleFactFiltersQuery(query, 'Invalid sale channel daily query params')
}
