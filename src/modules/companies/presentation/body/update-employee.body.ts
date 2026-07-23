import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type UpdateEmployeeInput } from '../../application/employees.service'

const optionalNullableTextSchema = z.union([z.string(), z.null()]).transform((value) => {
  if (value === null) {
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

const updateEmployeeBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    branchId: safePositiveIntSchema.optional(),
    erpId: safePositiveIntSchema.optional(),
    extensionNumber: optionalNullableTextSchema.optional(),
    extensionUuid: optionalNullableTextSchema.optional(),
    chatId: optionalNullableTextSchema.optional(),
    isNonCommercial: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.branchId !== undefined ||
      body.erpId !== undefined ||
      body.extensionNumber !== undefined ||
      body.extensionUuid !== undefined ||
      body.chatId !== undefined ||
      body.isNonCommercial !== undefined ||
      body.isActive !== undefined,
    {
      message: 'missing-fields',
    },
  )

export function parseUpdateEmployeeBody(body: Record<string, unknown>): UpdateEmployeeInput {
  const parsed = updateEmployeeBodySchema.safeParse({
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
