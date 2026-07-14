import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type CreateWhatsAppDepartmentMappingInput } from '../../application/whatsapp-department-mappings.service'

const uuidSchema = z.string().uuid()

const createWhatsAppDepartmentMappingBodySchema = z.object({
  departmentId: uuidSchema,
  departmentLabel: z.string().trim().min(1).nullable().optional(),
  cityId: uuidSchema.nullable().optional(),
})

export function parseCreateWhatsAppDepartmentMappingBody(
  body: Record<string, unknown>,
): CreateWhatsAppDepartmentMappingInput {
  const parsed = createWhatsAppDepartmentMappingBodySchema.safeParse({
    departmentId: body.departmentId,
    departmentLabel: body.departmentLabel,
    cityId: body.cityId,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp department mapping payload')
  }

  return parsed.data
}
