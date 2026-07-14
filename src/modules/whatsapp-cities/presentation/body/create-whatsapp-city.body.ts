import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type CreateWhatsAppCityInput } from '../../application/whatsapp-cities.service'

const createWhatsAppCityBodySchema = z.object({
  name: z.string().trim().min(1),
})

export function parseCreateWhatsAppCityBody(body: Record<string, unknown>): CreateWhatsAppCityInput {
  const parsed = createWhatsAppCityBodySchema.safeParse({
    name: body.name,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp city payload')
  }

  return parsed.data
}
