import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { EmployeeFilters } from '../../application/employees.service'

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
})

export function parseEmployeesQuery(query: Record<string, unknown>): EmployeeFilters {
  const parsed = employeesQuerySchema.safeParse({
    branchId: query.branchId,
    search: query.search,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid employees query params')
  }

  return parsed.data
}
