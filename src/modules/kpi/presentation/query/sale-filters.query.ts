import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'

export type SaleStatusQuery = 'Ativa' | 'Cancelada'

export type SaleBasePeriodQuery = {
  from: string
  to: string
}

export type SaleFactFiltersQuery = SaleBasePeriodQuery & {
  sellerId?: number
  status?: SaleStatusQuery
  orderType?: string
}

const numericIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d+$/)
  .refine((value) => {
    try {
      return BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)
    } catch {
      return false
    }
  })
  .transform((value) => Number(value))

const orderTypeSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const saleBasePeriodSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

const saleFactFiltersSchema = saleBasePeriodSchema.extend({
  sellerId: numericIdSchema.optional(),
  status: z.enum(['Ativa', 'Cancelada']).optional(),
  orderType: orderTypeSchema,
})

export function parseSaleFactFiltersQuery(
  query: Record<string, unknown>,
  errorMessage: string,
): SaleFactFiltersQuery {
  const parsed = saleFactFiltersSchema.safeParse({
    from: query.from,
    to: query.to,
    sellerId: query.sellerId,
    status: query.status,
    orderType: query.orderType,
  })

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

function isValidPeriod(input: SaleBasePeriodQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}
