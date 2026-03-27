import { seedFerracosulAdmin } from './seed-ferracosul-admin'

describe('seedFerracosulAdmin', () => {
  it('upserts an active admin user into the resolved ferracosul tenant', async () => {
    const repositories = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tenant-ferracosul',
            slug: 'ferracosul-matriz',
            name: 'Ferracosul Matriz',
            backendClientId: 'ferracosul',
            isActive: true,
          },
        ]),
      },
      user: {
        upsert: jest.fn().mockResolvedValue({
          id: 'user-admin-sinapse',
          email: 'admin@sinapse.com',
        }),
      },
      membership: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }

    const result = await seedFerracosulAdmin(repositories, {
      email: 'admin@sinapse.com',
      password: 'admin@123',
      name: 'Administrador Ferracosul',
    })

    expect(result).toEqual({
      email: 'admin@sinapse.com',
      tenantId: 'tenant-ferracosul',
      userId: 'user-admin-sinapse',
    })

    expect(repositories.user.upsert).toHaveBeenCalledTimes(1)
    const [userUpsertArgs] = repositories.user.upsert.mock.calls[0]

    expect(userUpsertArgs.where).toEqual({ email: 'admin@sinapse.com' })
    expect(userUpsertArgs.create).toMatchObject({
      id: 'user-admin-sinapse',
      email: 'admin@sinapse.com',
      name: 'Administrador Ferracosul',
      isActive: true,
      isSuperAdmin: false,
    })
    expect(userUpsertArgs.create.passwordHash).toEqual(expect.stringMatching(/^scrypt\$/))
    expect(userUpsertArgs.create.passwordHash).not.toBe('admin@123')
    expect(userUpsertArgs.update.passwordHash).toEqual(expect.stringMatching(/^scrypt\$/))
    expect(userUpsertArgs.update.passwordHash).not.toBe('admin@123')

    expect(repositories.membership.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_userId: {
          tenantId: 'tenant-ferracosul',
          userId: 'user-admin-sinapse',
        },
      },
      create: {
        id: 'membership-admin-sinapse-ferracosul',
        tenantId: 'tenant-ferracosul',
        userId: 'user-admin-sinapse',
        role: 'ADMIN',
        isActive: true,
      },
      update: {
        role: 'ADMIN',
        isActive: true,
      },
    })
  })

  it('fails when no active ferracosul tenant can be resolved', async () => {
    const repositories = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        upsert: jest.fn(),
      },
      membership: {
        upsert: jest.fn(),
      },
    }

    await expect(
      seedFerracosulAdmin(repositories, {
        email: 'admin@sinapse.com',
        password: 'admin@123',
      }),
    ).rejects.toThrow('Active Ferracosul tenant not found')
  })
})
