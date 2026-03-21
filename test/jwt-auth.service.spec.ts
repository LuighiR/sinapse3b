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
})
