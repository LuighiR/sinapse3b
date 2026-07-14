import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type UpdateWhatsAppCityInput } from '../../application/whatsapp-cities.service'

const updateWhatsAppCityBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => body.name !== undefined || body.isActive !== undefined, {
    message: 'missing-fields',
  })

export function parseUpdateWhatsAppCityBody(body: Record<string, unknown>): UpdateWhatsAppCityInput {
  const parsed = updateWhatsAppCityBodySchema.safeParse({
    name: body.name,
    isActive: body.isActive,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp city payload')
  }

  return parsed.data
}
