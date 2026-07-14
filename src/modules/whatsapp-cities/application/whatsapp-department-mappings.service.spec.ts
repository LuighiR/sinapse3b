import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { WhatsAppDepartmentMappingsService } from './whatsapp-department-mappings.service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CITY_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_CITY_ID = '22222222-2222-4222-8222-222222222222'
const DEPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MAPPING_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

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

function makeCity(overrides: Partial<{ id: string; clientId: string; name: string }> = {}) {
  const now = new Date('2026-07-14T12:00:00.000Z')
  return {
    id: overrides.id ?? CITY_ID,
    clientId: overrides.clientId ?? 'ferracosul',
    name: overrides.name ?? 'Pelotas',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
}

function makeMapping(
  overrides: Partial<{
    id: string
    clientId: string
    departmentId: string
    departmentLabel: string | null
    cityId: string | null
    status: 'PENDING' | 'MAPPED'
  }> = {},
) {
  const now = new Date('2026-07-14T12:00:00.000Z')
  return {
    id: overrides.id ?? MAPPING_ID,
    clientId: overrides.clientId ?? 'ferracosul',
    departmentId: overrides.departmentId ?? DEPT_ID,
    departmentLabel: overrides.departmentLabel === undefined ? 'Fila Pelotas' : overrides.departmentLabel,
    cityId: overrides.cityId === undefined ? CITY_ID : overrides.cityId,
    status: overrides.status ?? 'MAPPED',
    createdAt: now,
    updatedAt: now,
  }
}

function makePrisma(overrides: {
  mappingFindFirst?: jest.Mock
  mappingFindMany?: jest.Mock
  mappingCreate?: jest.Mock
  mappingUpdate?: jest.Mock
  cityFindFirst?: jest.Mock
  sessionUpdateMany?: jest.Mock
} = {}) {
  return {
    whatsAppDepartmentMapping: {
      findFirst: overrides.mappingFindFirst ?? jest.fn(),
      findMany: overrides.mappingFindMany ?? jest.fn(),
      create: overrides.mappingCreate ?? jest.fn(),
      update: overrides.mappingUpdate ?? jest.fn(),
    },
    whatsAppCity: {
      findFirst: overrides.cityFindFirst ?? jest.fn(),
    },
    messagingSession: {
      updateMany: overrides.sessionUpdateMany ?? jest.fn().mockResolvedValue({ count: 0 }),
    },
  }
}

describe('WhatsAppDepartmentMappingsService', () => {
  it('POST with cityId creates MAPPED mapping and syncs sessions for the department', async () => {
    const created = makeMapping({ status: 'MAPPED', cityId: CITY_ID })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(null),
      cityFindFirst: jest.fn().mockResolvedValue(makeCity()),
      mappingCreate: jest.fn().mockResolvedValue(created),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.create(makeAuthContext(), {
      departmentId: DEPT_ID,
      departmentLabel: 'Fila Pelotas',
      cityId: CITY_ID,
    })

    expect(result).toEqual(created)
    expect(prisma.whatsAppDepartmentMapping.create).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(UUID_RE),
        clientId: 'ferracosul',
        departmentId: DEPT_ID,
        departmentLabel: 'Fila Pelotas',
        cityId: CITY_ID,
        status: 'MAPPED',
      },
    })
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: CITY_ID },
    })
  })

  it('POST without cityId creates PENDING mapping and does not sync sessions', async () => {
    const created = makeMapping({
      status: 'PENDING',
      cityId: null,
      departmentLabel: null,
    })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(null),
      mappingCreate: jest.fn().mockResolvedValue(created),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.create(makeAuthContext(), {
      departmentId: DEPT_ID,
    })

    expect(result).toEqual(created)
    expect(prisma.whatsAppDepartmentMapping.create).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(UUID_RE),
        clientId: 'ferracosul',
        departmentId: DEPT_ID,
        departmentLabel: null,
        cityId: null,
        status: 'PENDING',
      },
    })
    expect(prisma.messagingSession.updateMany).not.toHaveBeenCalled()
  })

  it('POST upserts existing PENDING mapping to MAPPED and syncs sessions', async () => {
    const existing = makeMapping({
      status: 'PENDING',
      cityId: null,
      departmentLabel: null,
    })
    const updated = makeMapping({ status: 'MAPPED', cityId: CITY_ID, departmentLabel: 'Pelotas' })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      cityFindFirst: jest.fn().mockResolvedValue(makeCity()),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.create(makeAuthContext(), {
      departmentId: DEPT_ID,
      departmentLabel: 'Pelotas',
      cityId: CITY_ID,
    })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppDepartmentMapping.create).not.toHaveBeenCalled()
    expect(prisma.whatsAppDepartmentMapping.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        departmentLabel: 'Pelotas',
        cityId: CITY_ID,
        status: 'MAPPED',
      },
    })
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: CITY_ID },
    })
  })

  it('PATCH omitting cityId only updates departmentLabel and preserves mapping', async () => {
    const existing = makeMapping({ status: 'MAPPED', cityId: CITY_ID, departmentLabel: 'Old' })
    const updated = makeMapping({ status: 'MAPPED', cityId: CITY_ID, departmentLabel: 'New label' })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.update(makeAuthContext(), existing.id, {
      departmentLabel: 'New label',
    })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppDepartmentMapping.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        departmentLabel: 'New label',
        cityId: CITY_ID,
        status: 'MAPPED',
      },
    })
    expect(prisma.messagingSession.updateMany).not.toHaveBeenCalled()
  })

  it('PATCH cityId null forces PENDING and zeros whatsappCityId on sessions', async () => {
    const existing = makeMapping({ status: 'MAPPED', cityId: CITY_ID })
    const updated = makeMapping({ status: 'PENDING', cityId: null })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.update(makeAuthContext(), existing.id, {
      cityId: null,
    })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppDepartmentMapping.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        departmentLabel: existing.departmentLabel,
        cityId: null,
        status: 'PENDING',
      },
    })
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: null },
    })
  })

  it('PATCH only status PENDING clears cityId and syncs sessions', async () => {
    const existing = makeMapping({ status: 'MAPPED', cityId: CITY_ID })
    const updated = makeMapping({ status: 'PENDING', cityId: null })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.update(makeAuthContext(), existing.id, {
      status: 'PENDING',
    })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppDepartmentMapping.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        departmentLabel: existing.departmentLabel,
        cityId: null,
        status: 'PENDING',
      },
    })
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: null },
    })
  })

  it('PATCH status MAPPED without resulting city after merge throws BadRequestException', async () => {
    const existing = makeMapping({ status: 'PENDING', cityId: null, departmentLabel: null })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)

    await expect(
      service.update(makeAuthContext(), existing.id, { status: 'MAPPED' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.whatsAppDepartmentMapping.update).not.toHaveBeenCalled()
    expect(prisma.messagingSession.updateMany).not.toHaveBeenCalled()
  })

  it('PATCH with cityId uuid and status PENDING throws BadRequestException', async () => {
    const existing = makeMapping({ status: 'PENDING', cityId: null })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      cityFindFirst: jest.fn().mockResolvedValue(makeCity()),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)

    await expect(
      service.update(makeAuthContext(), existing.id, {
        cityId: CITY_ID,
        status: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.whatsAppDepartmentMapping.update).not.toHaveBeenCalled()
  })

  it('throws NotFoundException when cityId belongs to another client', async () => {
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(null),
      cityFindFirst: jest.fn().mockResolvedValue(null),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)

    await expect(
      service.create(makeAuthContext('ferracosul'), {
        departmentId: DEPT_ID,
        cityId: OTHER_CITY_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.whatsAppCity.findFirst).toHaveBeenCalledWith({
      where: { id: OTHER_CITY_ID, clientId: 'ferracosul' },
    })
    expect(prisma.whatsAppDepartmentMapping.create).not.toHaveBeenCalled()
  })

  it('throws NotFoundException when cityId does not exist', async () => {
    const existing = makeMapping({ status: 'PENDING', cityId: null })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      cityFindFirst: jest.fn().mockResolvedValue(null),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)

    await expect(
      service.update(makeAuthContext(), existing.id, { cityId: OTHER_CITY_ID }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.whatsAppDepartmentMapping.update).not.toHaveBeenCalled()
  })

  it('syncs sessions selectively via messagingSession.updateMany on clientId + externalDepartmentId', async () => {
    const existing = makeMapping({ status: 'MAPPED', cityId: CITY_ID })
    const updated = makeMapping({ status: 'MAPPED', cityId: OTHER_CITY_ID })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      cityFindFirst: jest.fn().mockResolvedValue(makeCity({ id: OTHER_CITY_ID, name: 'Rio Grande' })),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    await service.update(makeAuthContext(), existing.id, { cityId: OTHER_CITY_ID })

    expect(prisma.messagingSession.updateMany).toHaveBeenCalledTimes(1)
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: OTHER_CITY_ID },
    })
  })

  it('PATCH with cityId uuid forces MAPPED and syncs sessions', async () => {
    const existing = makeMapping({ status: 'PENDING', cityId: null, departmentLabel: 'Fila' })
    const updated = makeMapping({ status: 'MAPPED', cityId: CITY_ID, departmentLabel: 'Fila' })
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(existing),
      cityFindFirst: jest.fn().mockResolvedValue(makeCity()),
      mappingUpdate: jest.fn().mockResolvedValue(updated),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.update(makeAuthContext(), existing.id, { cityId: CITY_ID })

    expect(result).toEqual(updated)
    expect(prisma.whatsAppDepartmentMapping.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        departmentLabel: 'Fila',
        cityId: CITY_ID,
        status: 'MAPPED',
      },
    })
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', externalDepartmentId: DEPT_ID },
      data: { whatsappCityId: CITY_ID },
    })
  })

  it('lists mappings filtered by status for the tenant', async () => {
    const mappings = [makeMapping({ status: 'PENDING', cityId: null })]
    const prisma = makePrisma({
      mappingFindMany: jest.fn().mockResolvedValue(mappings),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)
    const result = await service.list(makeAuthContext(), { status: 'PENDING' })

    expect(result).toEqual(mappings)
    expect(prisma.whatsAppDepartmentMapping.findMany).toHaveBeenCalledWith({
      where: { clientId: 'ferracosul', status: 'PENDING' },
      orderBy: { departmentId: 'asc' },
    })
  })

  it('throws NotFoundException when patching a mapping from another client', async () => {
    const prisma = makePrisma({
      mappingFindFirst: jest.fn().mockResolvedValue(null),
    })

    const service = new WhatsAppDepartmentMappingsService(prisma as any)

    await expect(
      service.update(makeAuthContext('ferracosul'), MAPPING_ID, { departmentLabel: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.whatsAppDepartmentMapping.update).not.toHaveBeenCalled()
  })
})
