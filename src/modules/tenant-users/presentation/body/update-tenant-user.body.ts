import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type UpdateTenantUserInput } from '../../application/tenant-users.service'

const updateTenantUserBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    password: z.string().trim().min(1).optional(),
    role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
    membershipIsActive: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.password !== undefined ||
      body.role !== undefined ||
      body.isActive !== undefined ||
      body.membershipIsActive !== undefined,
    {
      message: 'missing-fields',
    },
  )

export function parseUpdateTenantUserBody(body: Record<string, unknown>): UpdateTenantUserInput {
  const parsed = updateTenantUserBodySchema.safeParse({
    name: body.name,
    password: body.password,
    role: body.role,
    isActive: body.isActive,
    membershipIsActive: body.membershipIsActive,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid tenant user payload')
  }

  return parsed.data
}
