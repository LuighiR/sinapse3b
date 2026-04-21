import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { PasswordHashService } from '../../auth/application/password-hash.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'
import { AuthContext } from '../../auth/domain/auth-context'

type MembershipRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'VIEWER'

type TenantUserFixture = {
  id: string
  email: string
  name?: string | null
  passwordHash?: string
  isActive?: boolean
}

type TenantMembershipFixture = {
  id?: string
  tenantId: string
  userId: string
  role?: MembershipRole
  isActive?: boolean
}

type TenantUserFixtures = {
  users?: TenantUserFixture[]
  memberships?: TenantMembershipFixture[]
}

type PrismaTenantUserReader = {
  user: {
    findUnique(args: unknown): Promise<{
      id: string
      email: string
      name: string | null
      isActive: boolean
    } | null>
    create(args: unknown): Promise<{
      id: string
      email: string
      name: string | null
      isActive: boolean
    }>
    update(args: unknown): Promise<{
      id: string
      email: string
      name: string | null
      isActive: boolean
    }>
  }
  membership: {
    findMany(args: unknown): Promise<Array<{
      role: MembershipRole
      isActive: boolean
      user: {
        id: string
        email: string
        name: string | null
        isActive: boolean
      }
    }>>
    findFirst(args: unknown): Promise<{
      id: string
      tenantId: string
      userId: string
      role: MembershipRole
      isActive: boolean
      user?: {
        id: string
        email: string
        name: string | null
        isActive: boolean
      }
    } | null>
    create(args: unknown): Promise<unknown>
    update(args: unknown): Promise<unknown>
  }
}

export type TenantUserSummary = {
  id: string
  email: string
  name: string | null
  isActive: boolean
  role: MembershipRole
  membershipIsActive: boolean
}

export type CreateTenantUserInput = {
  email: string
  name?: string
  password: string
  role: MembershipRole
  isActive?: boolean
}

export type UpdateTenantUserInput = {
  name?: string
  password?: string
  role?: MembershipRole
  isActive?: boolean
  membershipIsActive?: boolean
}

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly passwordHashService: PasswordHashService,
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: TenantUserFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async listForTenant(authContext: AuthContext): Promise<TenantUserSummary[]> {
    this.assertManagePermission(authContext)

    if (this.fixtures !== null) {
      return this.listFromFixtures(authContext.tenantId)
    }

    return this.listFromPrisma(authContext.tenantId)
  }

  async createForTenant(authContext: AuthContext, input: CreateTenantUserInput): Promise<TenantUserSummary> {
    this.assertManagePermission(authContext)

    if (this.fixtures !== null) {
      return this.createFromFixtures(authContext.tenantId, input)
    }

    return this.createFromPrisma(authContext.tenantId, input)
  }

  async updateForTenant(
    authContext: AuthContext,
    userId: string,
    input: UpdateTenantUserInput,
  ): Promise<TenantUserSummary> {
    this.assertManagePermission(authContext)

    if (this.fixtures !== null) {
      return this.updateFromFixtures(authContext.tenantId, userId, input)
    }

    return this.updateFromPrisma(authContext.tenantId, userId, input)
  }

  private assertManagePermission(authContext: AuthContext) {
    if (authContext.membership.role !== 'OWNER' && authContext.membership.role !== 'ADMIN') {
      throw new ForbiddenException('Tenant user administration requires owner or admin membership')
    }
  }

  private listFromFixtures(tenantId: string): TenantUserSummary[] {
    return (this.fixtures?.memberships ?? [])
      .filter((membership) => membership.tenantId === tenantId)
      .map((membership) => {
        const user = this.fixtures?.users?.find((candidate) => candidate.id === membership.userId)

        if (user === undefined) {
          return null
        }

        return this.toTenantUserSummary(user, membership)
      })
      .filter((user): user is TenantUserSummary => user !== null)
      .sort((left, right) => left.email.localeCompare(right.email))
  }

  private createFromFixtures(tenantId: string, input: CreateTenantUserInput): TenantUserSummary {
    const users = this.fixtures?.users ?? []
    const memberships = this.fixtures?.memberships ?? []
    const normalizedEmail = normalizeEmail(input.email)
    const passwordHash = this.passwordHashService.hash(input.password)
    const desiredIsActive = input.isActive ?? true

    let user = users.find((candidate) => normalizeEmail(candidate.email) === normalizedEmail)

    if (user === undefined) {
      user = {
        id: randomUUID(),
        email: normalizedEmail,
        name: input.name,
        passwordHash,
        isActive: desiredIsActive,
      }
      users.push(user)
    } else {
      user.email = normalizedEmail
      user.name = input.name ?? user.name ?? null
      user.passwordHash = passwordHash
      user.isActive = desiredIsActive
    }

    let membership = memberships.find((candidate) => candidate.tenantId === tenantId && candidate.userId === user.id)

    if (membership === undefined) {
      membership = {
        id: randomUUID(),
        tenantId,
        userId: user.id,
        role: input.role,
        isActive: true,
      }
      memberships.push(membership)
    } else {
      membership.role = input.role
      membership.isActive = true
    }

    return this.toTenantUserSummary(user, membership)
  }

  private updateFromFixtures(tenantId: string, userId: string, input: UpdateTenantUserInput): TenantUserSummary {
    const membership = (this.fixtures?.memberships ?? []).find(
      (candidate) => candidate.tenantId === tenantId && candidate.userId === userId,
    )

    if (membership === undefined) {
      throw new NotFoundException('Tenant user not found')
    }

    const user = (this.fixtures?.users ?? []).find((candidate) => candidate.id === userId)

    if (user === undefined) {
      throw new NotFoundException('Tenant user not found')
    }

    if (input.name !== undefined) {
      user.name = input.name
    }

    if (input.password !== undefined) {
      user.passwordHash = this.passwordHashService.hash(input.password)
    }

    if (input.isActive !== undefined) {
      user.isActive = input.isActive
    }

    if (input.role !== undefined) {
      membership.role = input.role
    }

    if (input.membershipIsActive !== undefined) {
      membership.isActive = input.membershipIsActive
    }

    return this.toTenantUserSummary(user, membership)
  }

  private async listFromPrisma(tenantId: string): Promise<TenantUserSummary[]> {
    if (this.prisma === undefined) {
      return []
    }

    const prisma = this.prisma as unknown as PrismaTenantUserReader
    const memberships = await prisma.membership.findMany({
      where: { tenantId },
      select: {
        role: true,
        isActive: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        user: {
          email: 'asc',
        },
      },
    })

    return memberships.map((membership) => ({
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      isActive: membership.user.isActive,
      role: membership.role,
      membershipIsActive: membership.isActive,
    }))
  }

  private async createFromPrisma(tenantId: string, input: CreateTenantUserInput): Promise<TenantUserSummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Tenant user persistence is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaTenantUserReader
    const normalizedEmail = normalizeEmail(input.email)
    const desiredIsActive = input.isActive ?? true
    const passwordHash = this.passwordHashService.hash(input.password)

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isActive: true },
    })

    const user =
      existingUser === null
        ? await prisma.user.create({
            data: {
              id: randomUUID(),
              email: normalizedEmail,
              name: input.name ?? null,
              passwordHash,
              isSuperAdmin: false,
              isActive: desiredIsActive,
              updatedAt: new Date(),
            },
            select: { id: true, email: true, name: true, isActive: true },
          })
        : await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: input.name ?? existingUser.name,
              passwordHash,
              isActive: desiredIsActive,
              updatedAt: new Date(),
            },
            select: { id: true, email: true, name: true, isActive: true },
          })

    const existingMembership = await prisma.membership.findFirst({
      where: { tenantId, userId: user.id },
      select: { id: true, tenantId: true, userId: true, role: true, isActive: true },
    })

    if (existingMembership === null) {
      await prisma.membership.create({
        data: {
          id: randomUUID(),
          tenantId,
          userId: user.id,
          role: input.role,
          isActive: true,
        },
      })
    } else {
      await prisma.membership.update({
        where: { id: existingMembership.id },
        data: {
          role: input.role,
          isActive: true,
        },
      })
    }

    return this.getTenantUserFromPrisma(tenantId, user.id)
  }

  private async updateFromPrisma(
    tenantId: string,
    userId: string,
    input: UpdateTenantUserInput,
  ): Promise<TenantUserSummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Tenant user persistence is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaTenantUserReader
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId },
      select: { id: true, tenantId: true, userId: true, role: true, isActive: true },
    })

    if (membership === null) {
      throw new NotFoundException('Tenant user not found')
    }

    if (input.name !== undefined || input.password !== undefined || input.isActive !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.password === undefined ? {} : { passwordHash: this.passwordHashService.hash(input.password) }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          updatedAt: new Date(),
        },
        select: { id: true, email: true, name: true, isActive: true },
      })
    }

    if (input.role !== undefined || input.membershipIsActive !== undefined) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          ...(input.role === undefined ? {} : { role: input.role }),
          ...(input.membershipIsActive === undefined ? {} : { isActive: input.membershipIsActive }),
        },
      })
    }

    return this.getTenantUserFromPrisma(tenantId, userId)
  }

  private async getTenantUserFromPrisma(tenantId: string, userId: string): Promise<TenantUserSummary> {
    const prisma = this.prisma as unknown as PrismaTenantUserReader
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId },
      select: {
        role: true,
        isActive: true,
        tenantId: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (membership === null || membership.user === undefined) {
      throw new NotFoundException('Tenant user not found')
    }

    return {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      isActive: membership.user.isActive,
      role: membership.role,
      membershipIsActive: membership.isActive,
    }
  }

  private toTenantUserSummary(user: TenantUserFixture, membership: TenantMembershipFixture): TenantUserSummary {
    return {
      id: user.id,
      email: normalizeEmail(user.email),
      name: user.name ?? null,
      isActive: user.isActive ?? true,
      role: membership.role ?? 'VIEWER',
      membershipIsActive: membership.isActive ?? true,
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
