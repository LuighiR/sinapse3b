import { parseWhatsAppSummaryQuery, type WhatsAppSummaryQuery } from './whatsapp-summary.query'

export type WhatsAppMessagesDailyQuery = WhatsAppSummaryQuery

export function parseWhatsAppMessagesDailyQuery(query: Record<string, unknown>): WhatsAppMessagesDailyQuery {
  return parseWhatsAppSummaryQuery(query)
}
