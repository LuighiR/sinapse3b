import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type ListWhatsAppCitiesQuery } from '../../application/whatsapp-cities.service'

const listWhatsAppCitiesQuerySchema = z.object({
  activeOnly: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined
      }

      return value === true || value === 'true'
    }),
})

export function parseListWhatsAppCitiesQuery(query: Record<string, unknown>): ListWhatsAppCitiesQuery {
  const parsed = listWhatsAppCitiesQuerySchema.safeParse({
    activeOnly: query.activeOnly,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp cities query params')
  }

  return parsed.data
}
