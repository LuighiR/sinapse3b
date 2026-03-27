import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { type LoginInput } from '../../application/auth-session.service'

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(1),
})

export function parseLoginBody(body: Record<string, unknown>): LoginInput {
  const parsed = loginBodySchema.safeParse({
    email: body.email,
    password: body.password,
  })

  if (!parsed.success) {
    throw new BadRequestException('Invalid login payload')
  }

  return parsed.data
}
