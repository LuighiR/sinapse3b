import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type WhatsAppTagHourlyQuery = {
  from: string
  to: string
  tagId: string
  chatId?: string
}

const optionalFilterTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const whatsappTagHourlyQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  tagId: z.string().trim().min(1),
  chatId: optionalFilterTextSchema,
})

export function parseWhatsAppTagHourlyQuery(query: Record<string, unknown>): WhatsAppTagHourlyQuery {
  const parsed = whatsappTagHourlyQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    tagId: query.tagId,
    chatId: query.chatId,
  })

  if (!parsed.success || !isValidPeriod(parsed.data) || !isValidTagId(parsed.data.tagId)) {
    throw new BadRequestException('Invalid whatsapp tag hourly query params')
  }

  return parsed.data
}

function isValidPeriod(input: Pick<WhatsAppTagHourlyQuery, 'from' | 'to'>): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}

function isValidTagId(value: string): boolean {
  try {
    BigInt(value)
    return true
  } catch {
    return false
  }
}
