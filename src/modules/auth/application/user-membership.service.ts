import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

export const AUTH_TEST_FIXTURES = 'AUTH_TEST_FIXTURES'

type MembershipRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'VIEWER'

type AuthFixtureUser = {
  id: string
  email: string
  name?: string | null
  isActive?: boolean
}

type AuthFixtureTenant = {
  id: string
  name?: string
  slug?: string
  isActive?: boolean
  backendClientId?: string | null
}

type AuthFixtureMembership = {
  tenantId: string
  userId: string
  role?: MembershipRole
  isActive?: boolean
}

type AuthFixtureClient = {
  id: string
  name: string
  isActive?: boolean
}

type AuthTestFixtures = {
  users?: AuthFixtureUser[]
  tenants?: AuthFixtureTenant[]
  memberships?: AuthFixtureMembership[]
  clients?: AuthFixtureClient[]
}

type PrismaAuthReader = {
  user: {
    findUnique(args: unknown): Promise<{ id: string; email: string; name: string | null; isActive: boolean } | null>
  }
  membership: {
    findFirst(args: unknown): Promise<{
      tenantId: string
      userId: string
      role: MembershipRole
      isActive: boolean
    } | null>
    findMany(args: unknown): Promise<Array<{
      role: MembershipRole
      tenant: {
        id: string
        name: string
        slug: string
        backendClientId: string | null
      }
    }>>
  }
  tenant: {
    findUnique(args: unknown): Promise<{
      id: string
      name: string
      slug: string
      isActive: boolean
      backendClientId: string | null
    } | null>
  }
  sinapseClient: {
    findUnique(args: unknown): Promise<{
      id: string
      name: string
      isActive: boolean
    } | null>
  }
}

export type ResolvedMembershipScope = {
  user: {
    id: string
    email: string
    name: string | null
  }
  membership: {
    tenantId: string
    userId: string
    role: MembershipRole
  }
  tenant: {
    id: string
    name: string
    slug: string
    backendClientId: string
  }
  client: {
    id: string
    name: string
  }
}

export type UserSummary = {
  id: string
  email: string
  name: string | null
}

export type UserTenantSummary = {
  id: string
  name: string
  slug: string
  role: MembershipRole
  backendClientId: string | null
}

@Injectable()
export class UserMembershipService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: AuthTestFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async resolveActiveScope(userId: string, tenantId: string): Promise<ResolvedMembershipScope> {
    if (this.fixtures !== null) {
      return this.resolveFromFixtures(userId, tenantId)
    }

    return this.resolveFromPrisma(userId, tenantId)
  }

  async getUserSummary(userId: string): Promise<UserSummary> {
    if (this.fixtures !== null) {
      return this.getUserSummaryFromFixtures(userId)
    }

    return this.getUserSummaryFromPrisma(userId)
  }

  async listActiveTenants(userId: string): Promise<UserTenantSummary[]> {
    if (this.fixtures !== null) {
      return this.listActiveTenantsFromFixtures(userId)
    }

    return this.listActiveTenantsFromPrisma(userId)
  }

  private resolveFromFixtures(userId: string, tenantId: string): ResolvedMembershipScope {
    const user = this.fixtures?.users?.find((candidate) => candidate.id === userId)

    if (user === undefined || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    const membership = this.fixtures?.memberships?.find(
      (candidate) => candidate.userId === userId && candidate.tenantId === tenantId,
    )

    if (membership === undefined || membership.isActive === false) {
      throw new ForbiddenException('Inactive membership')
    }

    const tenant = this.fixtures?.tenants?.find((candidate) => candidate.id === tenantId)

    if (tenant === undefined || tenant.isActive === false || tenant.backendClientId == null) {
      throw new ForbiddenException('Inactive tenant')
    }

    const client = this.fixtures?.clients?.find((candidate) => candidate.id === tenant.backendClientId)

    if (client === undefined || client.isActive === false) {
      throw new ForbiddenException('Inactive backend client')
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
      },
      membership: {
        tenantId: membership.tenantId,
        userId: membership.userId,
        role: membership.role ?? 'VIEWER',
      },
      tenant: {
        id: tenant.id,
        name: tenant.name ?? tenant.id,
        slug: tenant.slug ?? tenant.id,
        backendClientId: tenant.backendClientId,
      },
      client: {
        id: client.id,
        name: client.name,
      },
    }
  }

  private async resolveFromPrisma(userId: string, tenantId: string): Promise<ResolvedMembershipScope> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Membership lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaAuthReader

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isActive: true },
    })

    if (user === null || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    const membership = await prisma.membership.findFirst({
      where: { userId, tenantId },
      select: {
        tenantId: true,
        userId: true,
        role: true,
        isActive: true,
      },
    })

    if (membership === null || membership.isActive === false) {
      throw new ForbiddenException('Inactive membership')
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        backendClientId: true,
      },
    })

    if (tenant === null || tenant.isActive === false || tenant.backendClientId == null) {
      throw new ForbiddenException('Inactive tenant')
    }

    const client = await prisma.sinapseClient.findUnique({
      where: { id: tenant.backendClientId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    })

    if (client === null || client.isActive === false) {
      throw new ForbiddenException('Inactive backend client')
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      membership: {
        tenantId: membership.tenantId,
        userId: membership.userId,
        role: membership.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        backendClientId: tenant.backendClientId,
      },
      client: {
        id: client.id,
        name: client.name,
      },
    }
  }

  private getUserSummaryFromFixtures(userId: string): UserSummary {
    const user = this.fixtures?.users?.find((candidate) => candidate.id === userId)

    if (user === undefined || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    }
  }

  private async getUserSummaryFromPrisma(userId: string): Promise<UserSummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('User lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaAuthReader
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isActive: true },
    })

    if (user === null || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    }
  }

  private listActiveTenantsFromFixtures(userId: string): UserTenantSummary[] {
    const user = this.fixtures?.users?.find((candidate) => candidate.id === userId)

    if (user === undefined || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    const tenants = (this.fixtures?.memberships ?? []).reduce<UserTenantSummary[]>((accumulator, membership) => {
      if (membership.userId !== userId || membership.isActive === false) {
        return accumulator
      }

        const tenant = this.fixtures?.tenants?.find((candidate) => candidate.id === membership.tenantId)

        if (tenant === undefined || tenant.isActive === false || tenant.backendClientId == null) {
          return accumulator
        }

        const client = this.fixtures?.clients?.find((candidate) => candidate.id === tenant.backendClientId)

        if (client === undefined || client.isActive === false) {
          return accumulator
        }

        accumulator.push({
          id: tenant.id,
          name: tenant.name ?? tenant.id,
          slug: tenant.slug ?? tenant.id,
          role: membership.role ?? 'VIEWER',
          backendClientId: tenant.backendClientId,
        })

        return accumulator
      }, [])

    return tenants.sort((left, right) => left.id.localeCompare(right.id))
  }

  private async listActiveTenantsFromPrisma(userId: string): Promise<UserTenantSummary[]> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Membership lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaAuthReader
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    })

    if (user === null || user.isActive === false) {
      throw new ForbiddenException('Inactive user')
    }

    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        isActive: true,
        tenant: {
          isActive: true,
          backendClient: {
            is: {
              isActive: true,
            },
          },
        },
      },
      select: {
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            backendClientId: true,
          },
        },
      },
      orderBy: { tenant: { id: 'asc' } },
    })

    return memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      role: membership.role,
      backendClientId: membership.tenant.backendClientId,
    }))
  }
}
