import { BadRequestException } from '@nestjs/common'

export function parseMessagingSyncQuery(query: Record<string, unknown>): { clientId: string } {
  const clientId = query.clientId

  if (typeof clientId !== 'string' || clientId.trim() === '') {
    throw new BadRequestException('Invalid messaging sync query params')
  }

  return {
    clientId: clientId.trim(),
  }
}
