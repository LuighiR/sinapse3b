import { parseSaleFactFiltersQuery, type SaleFactFiltersQuery } from './sale-filters.query'

export type SaleDailyQuery = SaleFactFiltersQuery

export function parseSaleDailyQuery(query: Record<string, unknown>): SaleDailyQuery {
  return parseSaleFactFiltersQuery(query, 'Invalid sale daily query params')
}
