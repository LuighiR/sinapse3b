import { BadRequestException } from '@nestjs/common'

export function parseMessagingNormalizeQuery(query: Record<string, unknown>): {
  clientId: string
  full: boolean
} {
  const clientId = query.clientId

  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new BadRequestException('Invalid messaging normalize query params')
  }

  const fullRaw = query.full

  return {
    clientId: clientId.trim(),
    full: fullRaw === 'true' || fullRaw === '1' || fullRaw === true,
  }
}
