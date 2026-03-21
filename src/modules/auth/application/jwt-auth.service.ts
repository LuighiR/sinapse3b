import { Injectable, UnauthorizedException } from '@nestjs/common'
import { jwtVerify } from 'jose'
import { loadEnv } from '../../../config/env'

export type JwtAuthClaims = {
  sub: string
}

@Injectable()
export class JwtAuthService {
  async verify(token: string): Promise<JwtAuthClaims> {
    const env = loadEnv(process.env)
    const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET)

    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: env.AUTH_JWT_ISSUER,
        audience: env.AUTH_JWT_AUDIENCE,
        requiredClaims: ['exp'],
      })

      if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
        throw new UnauthorizedException('JWT subject is required')
      }

      return { sub: payload.sub }
    } catch {
      throw new UnauthorizedException('Invalid bearer token')
    }
  }
}
