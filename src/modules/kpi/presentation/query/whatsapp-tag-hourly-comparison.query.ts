import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { numericIdSchema } from './budget-filters.query'
import { parseWhatsAppTagHourlyQuery, type WhatsAppTagHourlyQuery } from './whatsapp-tag-hourly.query'

export type WhatsAppTagHourlyComparisonQuery = WhatsAppTagHourlyQuery & {
  sellerId?: number
}

const whatsappTagHourlyComparisonSchema = z.object({
  sellerId: numericIdSchema.optional(),
})

export function parseWhatsAppTagHourlyComparisonQuery(
  query: Record<string, unknown>,
): WhatsAppTagHourlyComparisonQuery {
  const base = parseWhatsAppTagHourlyQuery(query)
  const parsed = whatsappTagHourlyComparisonSchema.safeParse({
    sellerId: query.sellerId,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp tag hourly comparison query params')
  }

  return {
    ...base,
    sellerId: parsed.data.sellerId,
  }
}
