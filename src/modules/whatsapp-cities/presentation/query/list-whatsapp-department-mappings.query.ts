import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type ListWhatsAppDepartmentMappingsQuery } from '../../application/whatsapp-department-mappings.service'

const listWhatsAppDepartmentMappingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'MAPPED']).optional(),
})

export function parseListWhatsAppDepartmentMappingsQuery(
  query: Record<string, unknown>,
): ListWhatsAppDepartmentMappingsQuery {
  const parsed = listWhatsAppDepartmentMappingsQuerySchema.safeParse({
    status: query.status,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid whatsapp department mappings query params')
  }

  return parsed.data
}
