import { UnauthorizedException } from '@nestjs/common'
import { SignJWT } from 'jose'
import { JwtAuthService } from '../src/modules/auth/application/jwt-auth.service'
import {
  TEST_AUTH_JWT_AUDIENCE,
  TEST_AUTH_JWT_ISSUER,
  TEST_AUTH_JWT_SECRET,
  buildJwt,
  ensureTestEnv,
} from './helpers/fakes'

describe('JwtAuthService', () => {
  beforeEach(() => {
    ensureTestEnv()
  })

  it('issues an access token and a refresh token for the same subject', async () => {
    const service = new JwtAuthService()

    const pair = await service.issueTokenPair('u1')

    expect(pair.tokenType).toBe('Bearer')
    expect(pair.expiresInSeconds).toBeGreaterThan(0)
    await expect(service.verify(pair.accessToken)).resolves.toEqual({ sub: 'u1' })
    await expect(service.verifyRefreshToken(pair.refreshToken)).resolves.toEqual({ sub: 'u1' })
  })

  it('accepts a valid token with an expiration time', async () => {
    const service = new JwtAuthService()

    await expect(service.verify(await buildJwt({ sub: 'u1' }))).resolves.toEqual({ sub: 'u1' })
  })

  it('rejects a validly signed token that is missing exp', async () => {
    const service = new JwtAuthService()
    const secret = new TextEncoder().encode(TEST_AUTH_JWT_SECRET)

    const token = await new SignJWT({ sub: 'u1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer(TEST_AUTH_JWT_ISSUER)
      .setAudience(TEST_AUTH_JWT_AUDIENCE)
      .sign(secret)

    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a refresh token in the bearer verifier', async () => {
    const service = new JwtAuthService()
    const pair = await service.issueTokenPair('u1')

    await expect(service.verify(pair.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
