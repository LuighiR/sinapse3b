import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { numericIdSchema } from './budget-filters.query'
import { KpiPeriod } from '../../domain/kpi-period'

export type WhatsAppTagHourlyQuery = {
  from: string
  to: string
  tagId: string
  chatId?: string
  branchId?: number
  whatsappCityId?: string
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
  branchId: numericIdSchema.optional(),
  whatsappCityId: z.string().uuid().optional(),
})

export function parseWhatsAppTagHourlyQuery(query: Record<string, unknown>): WhatsAppTagHourlyQuery {
  const parsed = whatsappTagHourlyQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    tagId: query.tagId,
    chatId: query.chatId,
    branchId: query.branchId,
    whatsappCityId: query.whatsappCityId,
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
