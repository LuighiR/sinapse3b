import { parseWhatsAppSummaryQuery, type WhatsAppSummaryQuery } from './whatsapp-summary.query'

export type WhatsAppSessionsHourlyQuery = WhatsAppSummaryQuery

export function parseWhatsAppSessionsHourlyQuery(query: Record<string, unknown>): WhatsAppSessionsHourlyQuery {
  return parseWhatsAppSummaryQuery(query)
}
