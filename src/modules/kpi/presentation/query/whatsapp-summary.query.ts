import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { numericIdSchema } from './budget-filters.query'
import { KpiPeriod } from '../../domain/kpi-period'

export type WhatsAppSummaryQuery = {
  from: string
  to: string
  chatId?: string
  branchId?: number
}

const optionalFilterTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const whatsappSummaryQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  chatId: optionalFilterTextSchema,
  branchId: numericIdSchema.optional(),
})

export function parseWhatsAppSummaryQuery(query: Record<string, unknown>): WhatsAppSummaryQuery {
  const parsed = whatsappSummaryQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    chatId: query.chatId,
    branchId: query.branchId,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException('Invalid whatsapp summary query params')
  }

  return parsed.data
}

function isValidPeriod(input: WhatsAppSummaryQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
