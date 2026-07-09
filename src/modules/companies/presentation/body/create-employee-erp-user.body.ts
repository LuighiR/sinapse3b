import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

const createEmployeeErpUserBodySchema = z.object({
  erpId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  branchId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})

export type CreateEmployeeErpUserBody = z.infer<typeof createEmployeeErpUserBodySchema>

export function parseCreateEmployeeErpUserBody(body: Record<string, unknown>): CreateEmployeeErpUserBody {
  const parsed = createEmployeeErpUserBodySchema.safeParse({
    erpId: coercePositiveInt(body.erpId),
    branchId: coercePositiveInt(body.branchId),
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid employee ERP user body')
  }

  return parsed.data
}

function coercePositiveInt(value: unknown): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10)
  }

  return value
}
