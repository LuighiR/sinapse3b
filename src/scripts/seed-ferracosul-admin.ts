import { randomBytes, scryptSync } from 'node:crypto'

type ResolvedTenant = {
  id: string
  slug: string
  name: string
  backendClientId: string | null
  isActive: boolean
}

type SeedFerracosulAdminInput = {
  email: string
  password: string
  name?: string
}

type SeedFerracosulAdminResult = {
  userId: string
  tenantId: string
  email: string
}

type SeedFerracosulAdminRepositories = {
  tenant: {
    findMany(args: unknown): Promise<ResolvedTenant[]>
  }
  user: {
    upsert(args: unknown): Promise<{
      id: string
      email: string
    }>
  }
  membership: {
    upsert(args: unknown): Promise<unknown>
  }
}

const FERRACOSUL_CLIENT_ID = 'ferracosul'
const DEFAULT_ADMIN_USER_ID = 'user-admin-sinapse'
const DEFAULT_MEMBERSHIP_ID = 'membership-admin-sinapse-ferracosul'

export async function seedFerracosulAdmin(
  repositories: SeedFerracosulAdminRepositories,
  input: SeedFerracosulAdminInput,
): Promise<SeedFerracosulAdminResult> {
  const tenant = await resolveFerracosulTenant(repositories)
  const passwordHash = hashPassword(input.password)
  const userId = DEFAULT_ADMIN_USER_ID

  const user = await repositories.user.upsert({
    where: {
      email: input.email,
    },
    create: {
      id: userId,
      email: input.email,
      name: input.name ?? 'Administrador Ferracosul',
      passwordHash,
      isSuperAdmin: false,
      isActive: true,
      updatedAt: new Date(),
    },
    update: {
      name: input.name ?? 'Administrador Ferracosul',
      passwordHash,
      isSuperAdmin: false,
      isActive: true,
      updatedAt: new Date(),
    },
  })

  await repositories.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    create: {
      id: DEFAULT_MEMBERSHIP_ID,
      tenantId: tenant.id,
      userId: user.id,
      role: 'ADMIN',
      isActive: true,
    },
    update: {
      role: 'ADMIN',
      isActive: true,
    },
  })

  return {
    userId: user.id,
    tenantId: tenant.id,
    email: user.email,
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')

  return `scrypt$${salt}$${derivedKey}`
}

async function resolveFerracosulTenant(
  repositories: Pick<SeedFerracosulAdminRepositories, 'tenant'>,
): Promise<ResolvedTenant> {
  const tenants = await repositories.tenant.findMany({
    where: {
      isActive: true,
      OR: [
        { slug: FERRACOSUL_CLIENT_ID },
        { backendClientId: FERRACOSUL_CLIENT_ID },
        {
          name: {
            equals: 'Ferracosul',
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: 'Ferracosul',
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      backendClientId: true,
      isActive: true,
    },
    orderBy: {
      id: 'asc',
    },
  })

  const exactSlugMatches = tenants.filter((tenant) => tenant.slug === FERRACOSUL_CLIENT_ID)
  const exactClientMatches = tenants.filter((tenant) => tenant.backendClientId === FERRACOSUL_CLIENT_ID)
  const exactNameMatches = tenants.filter((tenant) => tenant.name.toLowerCase() === 'ferracosul')
  const fuzzyNameMatches = tenants

  return pickTenant(
    exactSlugMatches,
    exactClientMatches,
    exactNameMatches,
    fuzzyNameMatches,
  )
}

function pickTenant(...candidateGroups: ResolvedTenant[][]): ResolvedTenant {
  for (const candidates of candidateGroups) {
    if (candidates.length === 1) {
      return candidates[0]
    }

    if (candidates.length > 1) {
      const printableCandidates = candidates
        .map((tenant) => `${tenant.id} (${tenant.slug})`)
        .join(', ')

      throw new Error(`Ferracosul tenant resolution is ambiguous: ${printableCandidates}`)
    }
  }

  throw new Error('Active Ferracosul tenant not found')
}
