import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { KpiPeriod } from '../../domain/kpi-period'
import { numericIdSchema } from './budget-filters.query'

type BudgetFollowUpPeriodQuery = {
  from: string
  to: string
}

type ReferenceAtParts = {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
  milliseconds: number
}

const REFERENCE_AT_WITH_TIMEZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([zZ]|[+-]\d{2}:\d{2})$/
const REFERENCE_AT_SAO_PAULO_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
const REFERENCE_AT_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export const followUpWindowSchema = z.enum(['within24h', 'after24h'])
export type FollowUpWindow = z.infer<typeof followUpWindowSchema>

export const followUpStatusSchema = z.enum(['converted', 'lost', 'open'])
export type FollowUpStatus = z.infer<typeof followUpStatusSchema>

const orderTypeSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const referenceAtSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => normalizeReferenceAtText(value))
  .refine((value) => isValidReferenceAtText(value), 'Invalid referenceAt')

const optionalDateSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()
  .refine((value) => value === undefined || isValidDateText(value), 'Invalid date')

const budgetFollowUpPeriodSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

export const budgetFollowUpSummaryQuerySchema = budgetFollowUpPeriodSchema.extend({
  referenceAt: referenceAtSchema,
  sellerId: numericIdSchema.optional(),
  orderType: orderTypeSchema,
})

export const budgetFollowUpDrilldownQuerySchema = budgetFollowUpSummaryQuerySchema.extend({
  date: optionalDateSchema,
  followUpWindow: followUpWindowSchema.optional(),
  followUpStatus: followUpStatusSchema.optional(),
})

export type BudgetFollowUpSummaryQuery = z.infer<typeof budgetFollowUpSummaryQuerySchema>
export type BudgetFollowUpDrilldownQuery = z.infer<typeof budgetFollowUpDrilldownQuerySchema>

export function normalizeReferenceAtText(value: string): string {
  const trimmed = value.trim()

  if (REFERENCE_AT_DATE_ONLY_PATTERN.test(trimmed)) {
    return `${trimmed}T23:59:59.999`
  }

  return trimmed
}

export function parseBudgetFollowUpQuery<T extends BudgetFollowUpPeriodQuery>(
  query: Record<string, unknown>,
  errorMessage: string,
  schema: z.ZodType<T>,
): T {
  const parsed = schema.safeParse(query)

  if (!parsed.success || !isValidPeriod(parsed.data)) {
    throw new BadRequestException(errorMessage)
  }

  return parsed.data
}

function isValidPeriod(input: BudgetFollowUpPeriodQuery): boolean {
  try {
    KpiPeriod.between(input)
    return true
  } catch {
    return false
  }
}

function isValidReferenceAtText(value: string): boolean {
  return parseReferenceAtText(value) !== null
}

function isValidDateText(value: string): boolean {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (match === null) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  )
}

function parseReferenceAtText(value: string): Date | null {
  const trimmed = normalizeReferenceAtText(value)

  if (trimmed.length === 0) {
    return null
  }

  return parseReferenceAtWithTimezone(trimmed) ?? parseReferenceAtInSaoPaulo(trimmed)
}

function parseReferenceAtWithTimezone(value: string): Date | null {
  const match = value.match(REFERENCE_AT_WITH_TIMEZONE_PATTERN)

  if (match === null) {
    return null
  }

  const parts = readReferenceAtParts(match)
  const offsetMinutes = match[8].toUpperCase() === 'Z' ? 0 : parseTimezoneOffsetMinutes(match[8])

  if (parts === null || offsetMinutes === null) {
    return null
  }

  return toDateAtOffset(parts, offsetMinutes)
}

function parseReferenceAtInSaoPaulo(value: string): Date | null {
  const match = value.match(REFERENCE_AT_SAO_PAULO_PATTERN)

  if (match === null) {
    return null
  }

  const parts = readReferenceAtParts(match)

  if (parts === null) {
    return null
  }

  return toDateAtOffset(parts, -KpiPeriod.saoPauloUtcOffsetHours * 60)
}

function readReferenceAtParts(match: RegExpMatchArray): ReferenceAtParts | null {
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const seconds = Number(match[6] ?? '0')
  const milliseconds = Number((match[7] ?? '0').padEnd(3, '0'))

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59 ||
    milliseconds < 0 ||
    milliseconds > 999
  ) {
    return null
  }

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    milliseconds,
  }
}

function toDateAtOffset(parts: ReferenceAtParts, offsetMinutes: number): Date | null {
  const parsed = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours,
      parts.minutes,
      parts.seconds,
      parts.milliseconds,
    ) - offsetMinutes * 60_000,
  )
  const localAtOffset = new Date(parsed.getTime() + offsetMinutes * 60_000)

  if (
    localAtOffset.getUTCFullYear() !== parts.year ||
    localAtOffset.getUTCMonth() + 1 !== parts.month ||
    localAtOffset.getUTCDate() !== parts.day ||
    localAtOffset.getUTCHours() !== parts.hours ||
    localAtOffset.getUTCMinutes() !== parts.minutes ||
    localAtOffset.getUTCSeconds() !== parts.seconds ||
    localAtOffset.getUTCMilliseconds() !== parts.milliseconds
  ) {
    return null
  }

  return parsed
}

function parseTimezoneOffsetMinutes(value: string): number | null {
  const match = value.match(/^([+-])(\d{2}):(\d{2})$/)

  if (match === null) {
    return null
  }

  const hours = Number(match[2])
  const minutes = Number(match[3])

  if (hours > 23 || minutes > 59) {
    return null
  }

  const sign = match[1] === '+' ? 1 : -1

  return sign * (hours * 60 + minutes)
}
