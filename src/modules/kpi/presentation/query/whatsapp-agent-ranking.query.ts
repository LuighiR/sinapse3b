import { parseWhatsAppSummaryQuery, type WhatsAppSummaryQuery } from './whatsapp-summary.query'

export type WhatsAppAgentRankingQuery = WhatsAppSummaryQuery

export function parseWhatsAppAgentRankingQuery(query: Record<string, unknown>): WhatsAppAgentRankingQuery {
  return parseWhatsAppSummaryQuery(query)
}
