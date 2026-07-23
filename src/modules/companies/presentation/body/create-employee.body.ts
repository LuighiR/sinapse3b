import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type CreateEmployeeInput } from '../../application/employees.service'

const optionalNullableTextSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) {
      return null
    }

    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  })

const safePositiveIntSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const asNumber = typeof value === 'number' ? value : Number(String(value).trim())

  if (!Number.isSafeInteger(asNumber) || asNumber <= 0) {
    ctx.addIssue({ code: 'custom', message: 'invalid-id' })
    return z.NEVER
  }

  return asNumber
})

const createEmployeeBodySchema = z.object({
  name: z.string().trim().min(1),
  branchId: safePositiveIntSchema,
  erpId: safePositiveIntSchema,
  extensionNumber: optionalNullableTextSchema,
  extensionUuid: optionalNullableTextSchema,
  chatId: optionalNullableTextSchema,
  isNonCommercial: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export function parseCreateEmployeeBody(body: Record<string, unknown>): CreateEmployeeInput {
  const parsed = createEmployeeBodySchema.safeParse({
    name: body.name,
    branchId: body.branchId,
    erpId: body.erpId,
    extensionNumber: body.extensionNumber,
    extensionUuid: body.extensionUuid,
    chatId: body.chatId,
    isNonCommercial: body.isNonCommercial,
    isActive: body.isActive,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid employee payload')
  }

  return parsed.data
}
