import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES, UserMembershipService, type UserSummary, type UserTenantSummary } from './user-membership.service'
import { JwtAuthService } from './jwt-auth.service'
import { PasswordHashService } from './password-hash.service'

type AuthFixtureUser = {
  id: string
  email: string
  name?: string | null
  passwordHash?: string
  isActive?: boolean
}

type AuthTestFixtures = {
  users?: AuthFixtureUser[]
}

type AuthUserRecord = {
  id: string
  email: string
  name: string | null
  passwordHash: string
  isActive: boolean
}

type PrismaAuthUserReader = {
  user: {
    findUnique(args: unknown): Promise<AuthUserRecord | null>
  }
}

export type LoginInput = {
  email: string
  password: string
}

export type RefreshInput = {
  refreshToken: string
}

export type AuthSessionPayload = {
  tokenType: 'Bearer'
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

export type LoginResult = AuthSessionPayload & {
  user: UserSummary
  tenants: UserTenantSummary[]
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly jwtAuthService: JwtAuthService,
    private readonly passwordHashService: PasswordHashService,
    private readonly userMembershipService: UserMembershipService,
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: AuthTestFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const userRecord = await this.findUserByEmail(input.email)

    if (
      userRecord === null ||
      userRecord.isActive === false ||
      !this.passwordHashService.verify(input.password, userRecord.passwordHash)
    ) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const [tokens, tenants] = await Promise.all([
      this.jwtAuthService.issueTokenPair(userRecord.id),
      this.userMembershipService.listActiveTenants(userRecord.id),
    ])

    return {
      ...tokens,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
      },
      tenants,
    }
  }

  async refresh(input: RefreshInput): Promise<AuthSessionPayload> {
    const claims = await this.jwtAuthService.verifyRefreshToken(input.refreshToken)

    try {
      await this.userMembershipService.getUserSummary(claims.sub)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    return this.jwtAuthService.issueTokenPair(claims.sub)
  }

  private async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase()

    if (this.fixtures !== null) {
      const user = this.fixtures.users?.find((candidate) => candidate.email.trim().toLowerCase() === normalizedEmail)

      if (user === undefined || typeof user.passwordHash !== 'string') {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        passwordHash: user.passwordHash,
        isActive: user.isActive ?? true,
      }
    }

    if (this.prisma === undefined) {
      return null
    }

    const prisma = this.prisma as unknown as PrismaAuthUserReader

    return prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isActive: true,
      },
    })
  }
}
