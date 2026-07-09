import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { EmployeeErpUsersService } from './employee-erp-users.service'

describe('EmployeeErpUsersService', () => {
  function buildPrismaMock(overrides: Record<string, unknown> = {}) {
    return {
      employee: {
        findFirst: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
      },
      employeeErpUser: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      ...overrides,
    }
  }

  it('lists erp users for an employee in the tenant', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.employeeErpUser.findMany.mockResolvedValue([
      { id: 1, erpId: 500n, branchId: 10 },
    ])

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.listForEmployee('c1', 20)).resolves.toEqual([
      { id: 1, erpId: 500, branchId: 10 },
    ])

    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 20, branch: { clientId: 'c1' } },
      select: { id: true },
    })
  })

  it('throws NotFoundException when listing erp users for an employee outside the tenant', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue(null)

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.listForEmployee('c1', 99)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('creates an erp user link for an employee in the tenant', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.branch.findFirst.mockResolvedValue({ id: 11, clientId: 'c1' })
    prisma.employeeErpUser.findFirst.mockResolvedValue(null)
    prisma.employeeErpUser.create.mockResolvedValue({ id: 2, erpId: 777n, branchId: 11 })

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.create('c1', 20, { erpId: 777, branchId: 11 })).resolves.toEqual({
      id: 2,
      erpId: 777,
      branchId: 11,
    })

    expect(prisma.employeeErpUser.create).toHaveBeenCalledWith({
      data: {
        employeeId: 20,
        clientId: 'c1',
        erpId: 777n,
        branchId: 11,
      },
      select: { id: true, erpId: true, branchId: true },
    })
  })

  it('throws BadRequestException when creating with a branch outside the tenant', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.branch.findFirst.mockResolvedValue(null)

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.create('c1', 20, { erpId: 777, branchId: 99 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('throws ConflictException when erpId already exists for the client', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.branch.findFirst.mockResolvedValue({ id: 11, clientId: 'c1' })
    prisma.employeeErpUser.findFirst.mockResolvedValue({ id: 9, employeeId: 21 })

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.create('c1', 20, { erpId: 500, branchId: 11 })).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('removes an erp user link for an employee in the tenant', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.employeeErpUser.deleteMany.mockResolvedValue({ count: 1 })

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.remove('c1', 20, 1)).resolves.toBeUndefined()
    expect(prisma.employeeErpUser.deleteMany).toHaveBeenCalledWith({
      where: { id: 1, employeeId: 20, clientId: 'c1' },
    })
  })

  it('throws NotFoundException when removing a link that belongs to another employee', async () => {
    const prisma = buildPrismaMock()
    prisma.employee.findFirst.mockResolvedValue({ id: 20 })
    prisma.employeeErpUser.deleteMany.mockResolvedValue({ count: 0 })

    const service = new EmployeeErpUsersService(null, prisma as never)

    await expect(service.remove('c1', 20, 99)).rejects.toBeInstanceOf(NotFoundException)
  })
})
