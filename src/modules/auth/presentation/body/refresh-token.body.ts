import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type RefreshInput } from '../../application/auth-session.service'

const refreshTokenBodySchema = z.object({
  refreshToken: z.string().trim().min(1),
})

export function parseRefreshTokenBody(body: Record<string, unknown>): RefreshInput {
  const parsed = refreshTokenBodySchema.safeParse({
    refreshToken: body.refreshToken,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid refresh payload')
  }

  return parsed.data
}
