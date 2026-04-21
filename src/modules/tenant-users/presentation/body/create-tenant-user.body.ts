import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type CreateTenantUserInput } from '../../application/tenant-users.service'

const createTenantUserBodySchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).optional(),
  password: z.string().trim().min(1),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER']),
  isActive: z.boolean().optional(),
})

export function parseCreateTenantUserBody(body: Record<string, unknown>): CreateTenantUserInput {
  const parsed = createTenantUserBodySchema.safeParse({
    email: body.email,
    name: body.name,
    password: body.password,
    role: body.role,
    isActive: body.isActive,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid tenant user payload')
  }

  return parsed.data
}
