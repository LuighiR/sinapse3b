import { BadRequestException } from '@nestjs/common'
import { KpiPeriod } from '../../../kpi/domain/kpi-period'

export const DEFAULT_DKW_MIGRATION_BATCH_SIZE = 2000

export function parseMessagingMigrateDkwQuery(query: Record<string, unknown>): {
  clientId: string
  period: KpiPeriod
  batchSize: number
} {
  const clientId = query.clientId

  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new BadRequestException('Invalid DKW migration query params')
  }

  const from = query.from
  const to = query.to

  if (typeof from !== 'string' || typeof to !== 'string' || from.trim() === '' || to.trim() === '') {
    throw new BadRequestException('Invalid DKW migration query params: from and to are required')
  }

  const batchSizeRaw = query.batchSize
  const batchSize =
    batchSizeRaw == null
      ? DEFAULT_DKW_MIGRATION_BATCH_SIZE
      : typeof batchSizeRaw === 'string' && batchSizeRaw.trim() !== ''
        ? Number(batchSizeRaw)
        : typeof batchSizeRaw === 'number'
          ? batchSizeRaw
          : NaN

  if (!Number.isFinite(batchSize) || batchSize < 1 || batchSize > 10_000) {
    throw new BadRequestException('Invalid DKW migration query params')
  }

  return {
    clientId: clientId.trim(),
    period: KpiPeriod.between({ from: from.trim(), to: to.trim() }),
    batchSize: Math.floor(batchSize),
  }
}
