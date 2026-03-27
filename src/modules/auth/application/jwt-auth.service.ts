import { Injectable, UnauthorizedException } from '@nestjs/common'
import { jwtVerify, SignJWT } from 'jose'
import { loadEnv } from '../../../config/env'

export type JwtAuthClaims = {
  sub: string
}

export type TokenPair = {
  tokenType: 'Bearer'
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

type TokenType = 'access' | 'refresh'

@Injectable()
export class JwtAuthService {
  async verify(token: string): Promise<JwtAuthClaims> {
    return this.verifyToken(token, 'access')
  }

  async verifyRefreshToken(token: string): Promise<JwtAuthClaims> {
    return this.verifyToken(token, 'refresh')
  }

  async issueTokenPair(subject: string): Promise<TokenPair> {
    const env = loadEnv(process.env)

    return {
      tokenType: 'Bearer',
      accessToken: await this.signToken(subject, 'access'),
      refreshToken: await this.signToken(subject, 'refresh'),
      expiresInSeconds: env.AUTH_ACCESS_TOKEN_TTL_MINUTES * 60,
    }
  }

  private async verifyToken(token: string, expectedTokenType: TokenType): Promise<JwtAuthClaims> {
    const env = loadEnv(process.env)
    const secret = new TextEncoder().encode(this.resolveSecret(expectedTokenType))

    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: env.AUTH_JWT_ISSUER,
        audience: env.AUTH_JWT_AUDIENCE,
        requiredClaims: ['exp'],
      })

      if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
        throw new UnauthorizedException('JWT subject is required')
      }

      if (expectedTokenType === 'refresh') {
        if (payload.tokenType !== 'refresh') {
          throw new UnauthorizedException('Invalid refresh token')
        }
      } else if (payload.tokenType === 'refresh') {
        throw new UnauthorizedException('Invalid bearer token')
      }

      return { sub: payload.sub }
    } catch {
      throw new UnauthorizedException(expectedTokenType === 'refresh' ? 'Invalid refresh token' : 'Invalid bearer token')
    }
  }

  private async signToken(subject: string, tokenType: TokenType): Promise<string> {
    const env = loadEnv(process.env)
    const secret = new TextEncoder().encode(this.resolveSecret(tokenType))
    const expiresIn = tokenType === 'refresh'
      ? `${env.AUTH_REFRESH_TOKEN_TTL_DAYS}d`
      : `${env.AUTH_ACCESS_TOKEN_TTL_MINUTES}m`

    return new SignJWT({ sub: subject, tokenType })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuer(env.AUTH_JWT_ISSUER)
      .setAudience(env.AUTH_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret)
  }

  private resolveSecret(tokenType: TokenType) {
    const env = loadEnv(process.env)

    if (tokenType === 'refresh' && env.AUTH_REFRESH_JWT_SECRET !== '') {
      return env.AUTH_REFRESH_JWT_SECRET
    }

    return env.AUTH_JWT_SECRET
  }
}
