import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type UpdateWhatsAppDepartmentMappingInput } from '../../application/whatsapp-department-mappings.service'

const uuidSchema = z.string().uuid()

const updateWhatsAppDepartmentMappingBodySchema = z
  .object({
    departmentLabel: z.string().trim().min(1).nullable().optional(),
    cityId: uuidSchema.nullable().optional(),
    status: z.enum(['PENDING', 'MAPPED']).optional(),
  })
  .refine(
    (body) =>
      body.departmentLabel !== undefined || body.cityId !== undefined || body.status !== undefined,
    { message: 'missing-fields' },
  )

export function parseUpdateWhatsAppDepartmentMappingBody(
  body: Record<string, unknown>,
): UpdateWhatsAppDepartmentMappingInput {
  const parsed = updateWhatsAppDepartmentMappingBodySchema.safeParse({
    departmentLabel: body.departmentLabel,
    cityId: body.cityId,
    status: body.status,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp department mapping payload')
  }

  return parsed.data
}
