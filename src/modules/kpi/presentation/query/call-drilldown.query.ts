import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type CallOutcomeQuery = 'ANSWERED' | 'UNANSWERED' | 'UNCLASSIFIED'

export type CallDrilldownQuery = {
  from: string
  to: string
  branchId?: number
  employeeId?: number
  extensionUuid?: string
  extensionNumber?: string
  status?: string
  direction?: string
  callerNumber?: string
  destinationNumber?: string
  durationMin?: number
  durationMax?: number
  outcome?: CallOutcomeQuery
  page: number
  pageSize: number
}

const optionalFilterTextSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const optionalPositiveIntSchema = z
  .preprocess(
    (value) => (value == null || value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  )

const optionalNonNegativeNumberSchema = z
  .preprocess(
    (value) => (value == null || value === '' ? undefined : value),
    z.coerce.number().nonnegative().optional(),
  )

const callDrilldownQuerySchema = z
  .object({
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
    branchId: optionalPositiveIntSchema,
    employeeId: optionalPositiveIntSchema,
    extensionUuid: optionalFilterTextSchema,
    extensionNumber: optionalFilterTextSchema,
    status: optionalFilterTextSchema,
    direction: optionalFilterTextSchema,
    callerNumber: optionalFilterTextSchema,
    destinationNumber: optionalFilterTextSchema,
    durationMin: optionalNonNegativeNumberSchema,
    durationMax: optionalNonNegativeNumberSchema,
    outcome: z.enum(['ANSWERED', 'UNANSWERED', 'UNCLASSIFIED']).optional(),
    page: z.preprocess(
      (value) => (value == null || value === '' ? 1 : value),
      z.coerce.number().int().min(1),
    ),
    pageSize: z.preprocess(
      (value) => (value == null || value === '' ? 50 : value),
      z.coerce.number().int().min(1).max(100),
    ),
  })
  .superRefine((value, context) => {
    if (
      value.durationMin !== undefined &&
      value.durationMax !== undefined &&
      value.durationMin > value.durationMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'durationMin must be less than or equal to durationMax',
        path: ['durationMin'],
      })
    }
  })

export function parseCallDrilldownQuery(query: Record<string, unknown>): CallDrilldownQuery {
  if (query.sellerId !== undefined) {
    throw new BadRequestException('Invalid call drilldown query params')
  }

  const parsed = callDrilldownQuerySchema.safeParse({
    from: query.from,
    to: query.to,
    branchId: query.branchId,
    employeeId: query.employeeId,
    extensionUuid: query.extensionUuid,
    extensionNumber: query.extensionNumber,
    status: query.status,
    direction: query.direction,
    callerNumber: query.callerNumber,
    destinationNumber: query.destinationNumber,
    durationMin: query.durationMin,
    durationMax: query.durationMax,
    outcome: query.outcome,
    page: query.page,
    pageSize: query.pageSize,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid call drilldown query params')
  }

  try {
    KpiPeriod.between(parsed.data)
  } catch {
    throw new BadRequestException('Invalid call drilldown query params')
  }

  return parsed.data
}
