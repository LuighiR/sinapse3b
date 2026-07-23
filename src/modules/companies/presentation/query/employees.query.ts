import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { EmployeeFilters } from '../../application/employees.service'

const booleanQuerySchema = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'boolean') {
      return value
    }

    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }

    if (normalized === 'false' || normalized === '0') {
      return false
    }

    ctx.addIssue({ code: 'custom', message: 'invalid-boolean' })
    return z.NEVER
  })
  .optional()

const employeesQuerySchema = z.object({
  branchId: z
    .string()
    .trim()
    .min(1)
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10))
    .optional(),
  search: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  includeInactive: booleanQuerySchema,
})

export function parseEmployeesQuery(query: Record<string, unknown>): EmployeeFilters {
  const parsed = employeesQuerySchema.safeParse({
    branchId: query.branchId,
    search: query.search,
    includeInactive: query.includeInactive,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid employees query params')
  }

  return parsed.data
}
