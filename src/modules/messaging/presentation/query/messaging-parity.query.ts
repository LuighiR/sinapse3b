import { BadRequestException } from '@nestjs/common'
import { KpiPeriod } from '../../../kpi/domain/kpi-period'

export function parseMessagingParityQuery(query: Record<string, unknown>): {
  clientId: string
  period: KpiPeriod
  topAgents: number
} {
  const clientId = query.clientId

  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new BadRequestException('Invalid messaging parity query params')
  }

  const from = query.from
  const to = query.to

  if (typeof from !== 'string' || typeof to !== 'string' || from.trim() === '' || to.trim() === '') {
    throw new BadRequestException('Invalid messaging parity query params')
  }

  const topAgentsRaw = query.topAgents
  const topAgents =
    topAgentsRaw == null
      ? 5
      : typeof topAgentsRaw === 'string' && topAgentsRaw.trim() !== ''
        ? Number(topAgentsRaw)
        : typeof topAgentsRaw === 'number'
          ? topAgentsRaw
          : NaN

  if (!Number.isFinite(topAgents) || topAgents < 1) {
    throw new BadRequestException('Invalid messaging parity query params')
  }

  return {
    clientId: clientId.trim(),
    period: KpiPeriod.between({ from: from.trim(), to: to.trim() }),
    topAgents: Math.floor(topAgents),
  }
}
