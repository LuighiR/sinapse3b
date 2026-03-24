import { parseSaleFactFiltersQuery, type SaleFactFiltersQuery } from './sale-filters.query'

export type SaleSummaryQuery = SaleFactFiltersQuery

export function parseSaleSummaryQuery(query: Record<string, unknown>): SaleSummaryQuery {
  return parseSaleFactFiltersQuery(query, 'Invalid sale summary query params')
}
