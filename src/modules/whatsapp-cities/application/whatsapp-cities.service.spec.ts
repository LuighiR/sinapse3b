import { ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AuthContext } from '../../auth/domain/auth-context'
import { WhatsAppCitiesService } from './whatsapp-cities.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function makeAuthContext(clientId = 'ferracosul'): AuthContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    clientId,
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
    membership: { tenantId: 'tenant-1', userId: 'user-1', role: 'ADMIN' },
    tenant: {
      id: 'tenant-1',
      name: 'Ferracosul',
      slug: 'ferracosul',
      backendClientId: clientId,
    },
    client: { id: clientId, name: 'Ferracosul' },
  }
}

function makeCity(overrides: Partial<{
  id: string
  clientId: string
  name: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}> = {}) {
  const now = new Date('2026-07-14T12:00:00.000Z')
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    clientId: overrides.clientId ?? 'ferracosul',
    name: overrides.name ?? 'Pelotas',
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe('WhatsAppCitiesService', () => {
  it('creates a city with authContext.clientId and a generated uuid', async () => {
    const created = makeCity({ name: 'Pelotas' })
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)
    const result = await service.create(makeAuthContext(), { name: 'Pelotas' })

    expect(result).toEqual(created)
    expect(prisma.whatsAppCity.create).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(UUID_RE),
        clientId: 'ferracosul',
        name: 'Pelotas',
        isActive: true,
      },
    })
  })

  it('throws ConflictException when (clientId, name) already exists', async () => {
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn().mockResolvedValue(makeCity({ name: 'Pelotas' })),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)

    await expect(service.create(makeAuthContext(), { name: 'Pelotas' })).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(prisma.whatsAppCity.create).not.toHaveBeenCalled()
  })

  it('throws ConflictException when create races on unique (clientId, name)', async () => {
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '7.5.0',
          }),
        ),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)

    await expect(service.create(makeAuthContext(), { name: 'Pelotas' })).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('patches name and isActive for a city owned by the tenant', async () => {
    const existing = makeCity({ name: 'Pelotas', isActive: true })
    const updated = makeCity({ name: 'Rio Grande', isActive: false })
    const prisma = {
      whatsAppCity: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(null),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(updated),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)
    const result = await service.update(makeAuthContext(), existing.id, {
      name: 'Rio Grande',
      isActive: false,
    })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppCity.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: existing.id, clientId: 'ferracosul' },
    })
    expect(prisma.whatsAppCity.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { name: 'Rio Grande', isActive: false },
    })
  })

  it('lists only active cities when activeOnly is true', async () => {
    const cities = [makeCity({ name: 'Pelotas', isActive: true })]
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue(cities),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)
    const result = await service.list(makeAuthContext(), { activeOnly: true })

    expect(result).toEqual(cities)
    expect(prisma.whatsAppCity.findMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', isActive: true },
      orderBy: { name: 'asc' },
    })
  })

  it('lists all cities for the tenant when activeOnly is omitted', async () => {
    const cities = [
      makeCity({ name: 'Pelotas', isActive: true }),
      makeCity({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Inactive City',
        isActive: false,
      }),
    ]
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue(cities),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)
    const result = await service.list(makeAuthContext())

    expect(result).toEqual(cities)
    expect(prisma.whatsAppCity.findMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul' },
      orderBy: { name: 'asc' },
    })
  })

  it('throws NotFoundException when getting a city from another client', async () => {
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)

    await expect(
      service.get(makeAuthContext('ferracosul'), '33333333-3333-4333-8333-333333333333'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.whatsAppCity.findFirst).toHaveBeenCalledWith({
      where: { id: '33333333-3333-4333-8333-333333333333', clientId: 'ferracosul' },
    })
  })

  it('throws NotFoundException when patching a city from another client', async () => {
    const prisma = {
      whatsAppCity: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    }

    const service = new WhatsAppCitiesService(prisma as any)

    await expect(
      service.update(makeAuthContext('ferracosul'), '33333333-3333-4333-8333-333333333333', {
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.whatsAppCity.update).not.toHaveBeenCalled()
  })
})
