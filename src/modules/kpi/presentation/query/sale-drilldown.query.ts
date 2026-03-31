import { parseSaleFactFiltersQuery, type SaleFactFiltersQuery } from './sale-filters.query'

export type SaleDrilldownQuery = SaleFactFiltersQuery

export function parseSaleDrilldownQuery(query: Record<string, unknown>): SaleDrilldownQuery {
  return parseSaleFactFiltersQuery(query, 'Invalid sale drilldown query params')
}
