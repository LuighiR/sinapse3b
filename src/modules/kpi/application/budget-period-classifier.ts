import { KpiPeriod } from '../domain/kpi-period'

export const budgetPeriodCard = {
  created: 'created',
  open: 'open',
  wonInPeriod: 'wonInPeriod',
  lostInPeriod: 'lostInPeriod',
  closedOutsidePeriod: 'closedOutsidePeriod',
  resolvedInPeriod: 'resolvedInPeriod',
  unclassified: 'unclassified',
} as const

export type BudgetPeriodCard = (typeof budgetPeriodCard)[keyof typeof budgetPeriodCard]

export const budgetPeriodCards = [
  budgetPeriodCard.created,
  budgetPeriodCard.open,
  budgetPeriodCard.wonInPeriod,
  budgetPeriodCard.lostInPeriod,
  budgetPeriodCard.closedOutsidePeriod,
  budgetPeriodCard.resolvedInPeriod,
  budgetPeriodCard.unclassified,
] as const

export type BudgetPeriodBounds = {
  fromKey: string
  toKey: string
}

export type BudgetPeriodSourceRecord = {
  budgetDate: Date | string
  statusNormalized: string | null
  closingDate?: Date | string | null
  cancellationDate?: Date | string | null
  payloadJson?: Record<string, unknown> | null
}

export type ClosedOutsideStatus = 'won' | 'lost'

export type BudgetPeriodClassification = {
  cards: BudgetPeriodCard[]
  closedOutsideStatus: ClosedOutsideStatus | null
}

type NormalizedStatus = 'OPEN' | 'WON' | 'LOST' | 'UNKNOWN'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LEGACY_CANCELLATION_DATE_KEYS = ['cancellation_date', 'cancellationDate']

export function toBudgetPeriodBounds(period: KpiPeriod): BudgetPeriodBounds {
  return {
    fromKey: KpiPeriod.formatDateKey(period.from),
    toKey: KpiPeriod.formatDateKey(period.to),
  }
}

export function classifyBudgetForPeriod(
  fact: BudgetPeriodSourceRecord,
  bounds: BudgetPeriodBounds,
): BudgetPeriodClassification {
  const status = normalizeStatus(fact.statusNormalized)
  const openingKey = toDateKey(fact.budgetDate)
  const createdInPeriod = openingKey !== null && isWithin(openingKey, bounds)
  const resolutionKey = resolveResolutionDateKey(fact, status)
  const resolvedWithinPeriod = resolutionKey !== null && isWithin(resolutionKey, bounds)
  const cards: BudgetPeriodCard[] = []
  let closedOutsideStatus: ClosedOutsideStatus | null = null

  if (status === 'WON' && resolvedWithinPeriod) {
    cards.push(budgetPeriodCard.wonInPeriod)
  }

  if (status === 'LOST' && resolvedWithinPeriod) {
    cards.push(budgetPeriodCard.lostInPeriod)
  }

  if (!createdInPeriod) {
    return { cards, closedOutsideStatus }
  }

  cards.push(budgetPeriodCard.created)

  if (status === 'OPEN') {
    cards.push(budgetPeriodCard.open)
  } else if (resolvedWithinPeriod) {
    cards.push(budgetPeriodCard.resolvedInPeriod)
  } else if (resolutionKey !== null && resolutionKey > bounds.toKey) {
    cards.push(budgetPeriodCard.closedOutsidePeriod)
    closedOutsideStatus = status === 'WON' ? 'won' : 'lost'
  } else {
    cards.push(budgetPeriodCard.unclassified)
  }

  return { cards, closedOutsideStatus }
}

function resolveResolutionDateKey(fact: BudgetPeriodSourceRecord, status: NormalizedStatus): string | null {
  if (status === 'WON') {
    return toOptionalDateKey(fact.closingDate)
  }

  if (status === 'LOST') {
    return toOptionalDateKey(fact.cancellationDate) ?? readLegacyCancellationDateKey(fact.payloadJson ?? null)
  }

  return null
}

function readLegacyCancellationDateKey(payloadJson: Record<string, unknown> | null): string | null {
  if (payloadJson === null) {
    return null
  }

  for (const key of LEGACY_CANCELLATION_DATE_KEYS) {
    const value = payloadJson[key]

    if (typeof value === 'string') {
      const dateKey = toDateKey(value)

      if (dateKey !== null) {
        return dateKey
      }
    }
  }

  return null
}

function toOptionalDateKey(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return toDateKey(value)
}

function toDateKey(value: Date | string): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : KpiPeriod.formatDateKey(value)
  }

  const dateKey = value.trim().slice(0, 10)

  return DATE_KEY_PATTERN.test(dateKey) ? dateKey : null
}

function isWithin(dateKey: string, bounds: BudgetPeriodBounds): boolean {
  return dateKey >= bounds.fromKey && dateKey <= bounds.toKey
}

function normalizeStatus(value: string | null): NormalizedStatus {
  const normalized = (value ?? '').toUpperCase()

  if (normalized === 'OPEN' || normalized === 'WON' || normalized === 'LOST') {
    return normalized
  }

  return 'UNKNOWN'
}
