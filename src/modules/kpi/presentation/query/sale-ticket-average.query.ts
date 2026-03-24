import { parseSaleFactFiltersQuery, type SaleFactFiltersQuery } from './sale-filters.query'

export type SaleTicketAverageQuery = SaleFactFiltersQuery

export function parseSaleTicketAverageQuery(query: Record<string, unknown>): SaleTicketAverageQuery {
  return parseSaleFactFiltersQuery(query, 'Invalid sale ticket average query params')
}
