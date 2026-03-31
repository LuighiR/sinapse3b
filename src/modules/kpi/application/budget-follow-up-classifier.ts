import { KpiPeriod } from '../domain/kpi-period'

export const followUpWindow = {
  within24h: 'within24h',
  after24h: 'after24h',
} as const

export type FollowUpWindow = (typeof followUpWindow)[keyof typeof followUpWindow]

export const followUpStatus = {
  converted: 'converted',
  lost: 'lost',
  open: 'open',
} as const

export type FollowUpStatus = (typeof followUpStatus)[keyof typeof followUpStatus]

export type BudgetFollowUpClassification = {
  window: FollowUpWindow
  status: FollowUpStatus
}

export type BudgetFollowUpSourceRecord = {
  statusNormalized: string | null
  budgetDatetime: Date | string | undefined | null
  closingDate?: Date | string | null
  cancellationDate?: Date | string | null
  cancelationTime?: string | null
  payloadJson?: Record<string, unknown> | null
}

const FOLLOW_UP_WINDOW_LIMIT_MS = 24 * 60 * 60 * 1000

export function classifyBudgetFollowUpRecord(
  fact: BudgetFollowUpSourceRecord,
  referenceAt: Date,
): BudgetFollowUpClassification | null {
  const status = normalizeStatus(fact.statusNormalized)

  if (status === null) {
    return null
  }

  const openedAt = toTimestamp(fact.budgetDatetime)

  if (openedAt === null) {
    return null
  }

  if (openedAt.getTime() > referenceAt.getTime()) {
    return null
  }

  if (status === followUpStatus.open) {
    return {
      window: toFollowUpWindow(openedAt, referenceAt),
      status: followUpStatus.open,
    }
  }

  const closingAt = status === followUpStatus.converted ? resolveClosingAt(fact) : resolveCancellationAt(fact)

  if (closingAt !== null && closingAt.getTime() <= referenceAt.getTime()) {
    return {
      window: toFollowUpWindow(openedAt, closingAt),
      status,
    }
  }

  return {
    window: toFollowUpWindow(openedAt, referenceAt),
    status: followUpStatus.open,
  }
}

function normalizeStatus(value: string | null): FollowUpStatus | null {
  const normalized = (value ?? '').toUpperCase()

  if (normalized === 'WON') {
    return followUpStatus.converted
  }

  if (normalized === 'LOST') {
    return followUpStatus.lost
  }

  if (normalized === 'OPEN') {
    return followUpStatus.open
  }

  return null
}

function resolveClosingAt(fact: BudgetFollowUpSourceRecord): Date | null {
  return resolveTerminalAt(fact.closingDate, readClosingTimeValue(fact.payloadJson ?? null))
}

function resolveCancellationAt(fact: BudgetFollowUpSourceRecord): Date | null {
  if (fact.cancellationDate !== null && fact.cancellationDate !== undefined) {
    return resolveTerminalAt(fact.cancellationDate, readStructuredCancellationTimeValue(fact.cancelationTime))
  }

  return resolveTerminalAt(
    readLegacyCancellationDateValue(fact.payloadJson ?? null),
    readLegacyCancellationTimeValue(fact.payloadJson ?? null),
  )
}

function resolveTerminalAt(
  dateValue: Date | string | undefined | null,
  timeValue: string | null,
): Date | null {
  if (dateValue === null || dateValue === undefined) {
    return null
  }

  const dayStart = toSaoPauloDayStart(dateValue)

  if (dayStart === null) {
    return null
  }

  if (timeValue === null) {
    return endOfSaoPauloDay(dayStart)
  }

  const timeParts = parseTimeParts(timeValue)

  if (timeParts === null) {
    return endOfSaoPauloDay(dayStart)
  }

  const [hours, minutes, seconds] = timeParts

  return new Date(
    Date.UTC(
      dayStart.getUTCFullYear(),
      dayStart.getUTCMonth(),
      dayStart.getUTCDate(),
      hours + KpiPeriod.saoPauloUtcOffsetHours,
      minutes,
      seconds,
    ),
  )
}

function readClosingTimeValue(payloadJson: Record<string, unknown> | null): string | null {
  return readPayloadTextValue(payloadJson, ['closing_time', 'closingTime'])
}

function readStructuredCancellationTimeValue(value: string | null | undefined): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }

  return null
}

function readLegacyCancellationDateValue(payloadJson: Record<string, unknown> | null): Date | string | null {
  const value = readPayloadTextValue(payloadJson, ['cancellation_date', 'cancellationDate'])

  return value
}

function readLegacyCancellationTimeValue(payloadJson: Record<string, unknown> | null): string | null {
  return readPayloadTextValue(payloadJson, ['cancelation_time', 'cancelationTime'])
}

function readPayloadTextValue(payloadJson: Record<string, unknown> | null, keys: string[]): string | null {
  if (payloadJson === null) {
    return null
  }

  for (const key of keys) {
    const value = payloadJson[key]

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }

  return null
}

function parseTimeParts(value: string): [number, number, number] | null {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)

  if (match === null) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? '0')

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null
  }

  return [hours, minutes, seconds]
}

function toSaoPauloDayStart(value: Date | string): Date | null {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

    if (match === null) {
      return null
    }

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const parsed = new Date(Date.UTC(year, month - 1, day, KpiPeriod.saoPauloUtcOffsetHours))

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      return null
    }

    return parsed
  }

  if (Number.isNaN(value.getTime())) {
    return null
  }

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      KpiPeriod.saoPauloUtcOffsetHours,
    ),
  )
}

function endOfSaoPauloDay(value: Date): Date {
  return new Date(value.getTime() + FOLLOW_UP_WINDOW_LIMIT_MS - 1)
}

function toTimestamp(value: Date | string | undefined | null): Date | null {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (looksLikeIsoTimestamp(value)) {
    return parseStrictIsoTimestamp(value)
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function looksLikeIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function parseStrictIsoTimestamp(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
  )

  if (match === null) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const seconds = Number(match[6] ?? '0')
  const milliseconds = Number((match[7] ?? '0').padEnd(3, '0'))
  const timezone = match[8]
  const offsetMinutes = timezone === 'Z' ? 0 : parseTimezoneOffsetMinutes(timezone)

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
    milliseconds > 999 ||
    offsetMinutes === null
  ) {
    return null
  }

  const parsed = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds) -
      offsetMinutes * 60_000,
  )

  const localAtOffset = new Date(parsed.getTime() + offsetMinutes * 60_000)

  if (
    localAtOffset.getUTCFullYear() !== year ||
    localAtOffset.getUTCMonth() + 1 !== month ||
    localAtOffset.getUTCDate() !== day ||
    localAtOffset.getUTCHours() !== hours ||
    localAtOffset.getUTCMinutes() !== minutes ||
    localAtOffset.getUTCSeconds() !== seconds ||
    localAtOffset.getUTCMilliseconds() !== milliseconds
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

function toFollowUpWindow(openedAt: Date, referenceAt: Date): FollowUpWindow {
  const elapsedMs = Math.max(0, referenceAt.getTime() - openedAt.getTime())

  return elapsedMs <= FOLLOW_UP_WINDOW_LIMIT_MS ? followUpWindow.within24h : followUpWindow.after24h
}
