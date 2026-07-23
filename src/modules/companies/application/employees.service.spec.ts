import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { EmployeesService } from './employees.service'

function buildAuthContext(role: AuthContext['membership']['role']): AuthContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
    membership: { tenantId: 'tenant-1', userId: 'user-1', role },
    tenant: {
      id: 'tenant-1',
      name: 'Tenant',
      slug: 'tenant',
      backendClientId: 'client-1',
    },
    client: { id: 'client-1', name: 'Client' },
  }
}

describe('EmployeesService', () => {
  const fixtures = {
    branches: [
      { id: 1, clientId: 'client-1' },
      { id: 2, clientId: 'client-1' },
      { id: 99, clientId: 'client-2' },
    ],
    employees: [
      {
        id: 10,
        name: 'Active Seller',
        branchId: 1,
        erpId: 100,
        extensionNumber: '101',
        extensionUuid: 'ext-101',
        chatId: 'active@example.com',
        isNonCommercial: false,
        isActive: true,
      },
      {
        id: 11,
        name: 'Inactive Seller',
        branchId: 1,
        erpId: 101,
        chatId: 'inactive@example.com',
        isActive: false,
      },
    ],
  }

  it('lists only active employees by default', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(service.listForClient(buildAuthContext('VIEWER'), {})).resolves.toEqual([
      expect.objectContaining({
        id: 10,
        erpId: 100,
        name: 'Active Seller',
        isActive: true,
      }),
    ])
  })

  it('includes inactive employees for manager when includeInactive is true', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    const rows = await service.listForClient(buildAuthContext('MANAGER'), { includeInactive: true })

    expect(rows.map((row) => row.id)).toEqual([10, 11])
  })

  it('ignores includeInactive for viewers', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    const rows = await service.listForClient(buildAuthContext('VIEWER'), { includeInactive: true })

    expect(rows.map((row) => row.id)).toEqual([10])
  })

  it('creates an employee for manager roles', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.createForClient(buildAuthContext('MANAGER'), {
        name: 'Nova Pessoa',
        branchId: 2,
        erpId: 200,
        chatId: 'nova@example.com',
      }),
    ).resolves.toEqual({
      id: 12,
      name: 'Nova Pessoa',
      branchId: 2,
      erpId: 200,
      extensionNumber: null,
      extensionUuid: null,
      chatId: 'nova@example.com',
      isNonCommercial: false,
      isActive: true,
    })
  })

  it('rejects create for viewer role', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.createForClient(buildAuthContext('VIEWER'), {
        name: 'Blocked',
        branchId: 1,
        erpId: 999,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects create when erpId already exists in the company', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.createForClient(buildAuthContext('ADMIN'), {
        name: 'Duplicate',
        branchId: 1,
        erpId: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException)

    await expect(
      service.createForClient(buildAuthContext('ADMIN'), {
        name: 'Duplicate',
        branchId: 1,
        erpId: 100,
      }),
    ).rejects.toThrow('Employee erpId already in use for this company')
  })

  it('rejects create when branch belongs to another client', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.createForClient(buildAuthContext('OWNER'), {
        name: 'Wrong Branch',
        branchId: 99,
        erpId: 300,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('soft-deactivates an employee via patch', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.updateForClient(buildAuthContext('ADMIN'), 10, { isActive: false }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 10,
        isActive: false,
      }),
    )

    await expect(service.listForClient(buildAuthContext('VIEWER'), {})).resolves.toEqual([])
  })

  it('returns 404 when patching an employee outside the tenant', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.updateForClient(buildAuthContext('ADMIN'), 999, { name: 'Missing' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('clears optional fields when patch sends null', async () => {
    const service = new EmployeesService(undefined, structuredClone(fixtures))

    await expect(
      service.updateForClient(buildAuthContext('MANAGER'), 10, {
        extensionNumber: null,
        extensionUuid: null,
        chatId: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 10,
        extensionNumber: null,
        extensionUuid: null,
        chatId: null,
      }),
    )
  })
})
