import { parseWhatsAppTagHourlyQuery, type WhatsAppTagHourlyQuery } from './whatsapp-tag-hourly.query'

export type WhatsAppTagHourlyComparisonQuery = WhatsAppTagHourlyQuery

export function parseWhatsAppTagHourlyComparisonQuery(
  query: Record<string, unknown>,
): WhatsAppTagHourlyComparisonQuery {
  return parseWhatsAppTagHourlyQuery(query)
}
