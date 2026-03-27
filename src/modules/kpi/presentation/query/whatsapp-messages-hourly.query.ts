import { parseWhatsAppSummaryQuery, type WhatsAppSummaryQuery } from './whatsapp-summary.query'

export type WhatsAppMessagesHourlyQuery = WhatsAppSummaryQuery

export function parseWhatsAppMessagesHourlyQuery(query: Record<string, unknown>): WhatsAppMessagesHourlyQuery {
  return parseWhatsAppSummaryQuery(query)
}
