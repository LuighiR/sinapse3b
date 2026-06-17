import { BadRequestException } from '@nestjs/common'
import { KpiPeriod } from '../../../kpi/domain/kpi-period'

export function parseMessagingBackfillContactsQuery(query: Record<string, unknown>): {
  clientId: string
  period?: KpiPeriod
} {
  const clientId = query.clientId

  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new BadRequestException('Invalid contacts backfill query params')
  }

  const from = query.from
  const to = query.to
  const hasFrom = typeof from === 'string' && from.trim() !== ''
  const hasTo = typeof to === 'string' && to.trim() !== ''

  if (hasFrom !== hasTo) {
    throw new BadRequestException('Invalid contacts backfill query params: from and to must be provided together')
  }

  return {
    clientId: clientId.trim(),
    period: hasFrom && hasTo ? KpiPeriod.between({ from: from.trim(), to: to.trim() }) : undefined,
  }
}
