import { ForbiddenException } from '@nestjs/common'
import { UserMembershipService } from './user-membership.service'

describe('UserMembershipService', () => {
  it('falls back to Prisma when test fixtures are not present', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'user@example.com',
          name: 'User One',
          isActive: true,
        }),
      },
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'u1',
          tenantId: 't1',
          role: 'ADMIN',
          isActive: true,
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          name: 'Tenant One',
          slug: 'tenant-one',
          isActive: true,
          backendClientId: 'c1',
        }),
      },
      sinapseClient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          name: 'Ferraco',
          isActive: true,
        }),
      },
    }

    const service = new UserMembershipService(null, prisma as never)

    await expect(service.resolveActiveScope('u1', 't1')).resolves.toEqual({
      user: {
        id: 'u1',
        email: 'user@example.com',
        name: 'User One',
      },
      membership: {
        tenantId: 't1',
        userId: 'u1',
        role: 'ADMIN',
      },
      tenant: {
        id: 't1',
        name: 'Tenant One',
        slug: 'tenant-one',
        backendClientId: 'c1',
      },
      client: {
        id: 'c1',
        name: 'Ferraco',
      },
    })
  })

  it('rejects inactive memberships from the Prisma fallback', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }),
      },
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'u1',
          tenantId: 't1',
          role: 'ADMIN',
          isActive: false,
        }),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      sinapseClient: {
        findUnique: jest.fn(),
      },
    }

    const service = new UserMembershipService(null, prisma as never)

    await expect(service.resolveActiveScope('u1', 't1')).rejects.toBeInstanceOf(ForbiddenException)
  })
})
