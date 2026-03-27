import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type WhatsAppSummaryQuery = {
  from: string
  to: string
  chatId?: string
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
})

export function parseWhatsAppSummaryQuery(query: Record<string, unknown>): WhatsAppSummaryQuery {
  const parsed = whatsappSummaryQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    chatId: query.chatId,
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
