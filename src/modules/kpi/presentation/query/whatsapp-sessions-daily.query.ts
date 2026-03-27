import { parseWhatsAppSummaryQuery, type WhatsAppSummaryQuery } from './whatsapp-summary.query'

export type WhatsAppSessionsDailyQuery = WhatsAppSummaryQuery

export function parseWhatsAppSessionsDailyQuery(query: Record<string, unknown>): WhatsAppSessionsDailyQuery {
  return parseWhatsAppSummaryQuery(query)
}
