import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type CallBasePeriodQuery = {
  from: string
  to: string
}

export type CallFactFiltersQuery = CallBasePeriodQuery & {
  extensionUuid?: string
  extensionNumber?: string
  branchId?: number
}

const optionalFilterTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const optionalFilterNumberSchema = z
  .preprocess(
    (value) => (value == null || value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  )

const callBasePeriodSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

const callFactFiltersSchema = callBasePeriodSchema.extend({
  extensionUuid: optionalFilterTextSchema,
  extensionNumber: optionalFilterTextSchema,
  branchId: optionalFilterNumberSchema,
})

export function parseCallFactFiltersQuery(
  query: Record<string, unknown>,
  errorMessage: string,
): CallFactFiltersQuery {
  if (query.sellerId !== undefined) {
    throw new BadRequestException(errorMessage)
  }

  const parsed = callFactFiltersSchema.safeParse({
    from: query.from,
    to: query.to,
    extensionUuid: query.extensionUuid,
    extensionNumber: query.extensionNumber,
    branchId: query.branchId,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

function isValidPeriod(input: CallBasePeriodQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
