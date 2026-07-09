import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'
import { EmployeeErpUserSummary } from './employees.service'

type ErpUserFixture = {
  id: number
  erpId: bigint
  branchId: number
}

type EmployeeFixture = {
  id: number
  branchId: number
  erpUsers?: ErpUserFixture[]
}

type BranchFixture = {
  id: number
  clientId: string
}

type EmployeeErpUserFixtures = {
  branches?: BranchFixture[]
  employees?: EmployeeFixture[]
}

type PrismaEmployeeErpUserClient = {
  employee: {
    findFirst(args: unknown): Promise<{ id: number } | null>
  }
  branch: {
    findFirst(args: unknown): Promise<{ id: number; clientId: string } | null>
  }
  employeeErpUser: {
    findMany(args: unknown): Promise<Array<{ id: number; erpId: bigint; branchId: number }>>
    findFirst(args: unknown): Promise<{ id: number; employeeId?: number } | null>
    create(args: unknown): Promise<{ id: number; erpId: bigint; branchId: number }>
    deleteMany(args: unknown): Promise<{ count: number }>
  }
}

@Injectable()
export class EmployeeErpUsersService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: EmployeeErpUserFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async listForEmployee(clientId: string, employeeId: number): Promise<EmployeeErpUserSummary[]> {
    if (this.fixtures !== null) {
      return this.listFromFixtures(clientId, employeeId)
    }

    return this.listFromPrisma(clientId, employeeId)
  }

  async create(
    clientId: string,
    employeeId: number,
    input: { erpId: number; branchId: number },
  ): Promise<EmployeeErpUserSummary> {
    if (this.fixtures !== null) {
      return this.createFromFixtures(clientId, employeeId, input)
    }

    return this.createFromPrisma(clientId, employeeId, input)
  }

  async remove(clientId: string, employeeId: number, erpUserId: number): Promise<void> {
    if (this.fixtures !== null) {
      return this.removeFromFixtures(clientId, employeeId, erpUserId)
    }

    return this.removeFromPrisma(clientId, employeeId, erpUserId)
  }

  private listFromFixtures(clientId: string, employeeId: number): EmployeeErpUserSummary[] {
    const employee = this.requireFixtureEmployee(clientId, employeeId)

    return (employee.erpUsers ?? [])
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((erpUser) => ({
        id: erpUser.id,
        erpId: serializeErpId(erpUser.erpId),
        branchId: erpUser.branchId,
      }))
  }

  private createFromFixtures(
    clientId: string,
    employeeId: number,
    input: { erpId: number; branchId: number },
  ): EmployeeErpUserSummary {
    const employee = this.requireFixtureEmployee(clientId, employeeId)
    this.requireFixtureBranch(clientId, input.branchId)
    this.assertFixtureErpIdAvailable(clientId, input.erpId)

    const nextId =
      Math.max(
        0,
        ...(this.fixtures?.employees ?? []).flatMap((item) => (item.erpUsers ?? []).map((erpUser) => erpUser.id)),
      ) + 1

    const created: ErpUserFixture = {
      id: nextId,
      erpId: BigInt(input.erpId),
      branchId: input.branchId,
    }

    employee.erpUsers = [...(employee.erpUsers ?? []), created]

    return {
      id: created.id,
      erpId: serializeErpId(created.erpId),
      branchId: created.branchId,
    }
  }

  private removeFromFixtures(clientId: string, employeeId: number, erpUserId: number): void {
    const employee = this.requireFixtureEmployee(clientId, employeeId)
    const erpUsers = employee.erpUsers ?? []
    const index = erpUsers.findIndex((erpUser) => erpUser.id === erpUserId)

    if (index < 0) {
      throw new NotFoundException('Employee ERP user not found')
    }

    employee.erpUsers = erpUsers.filter((erpUser) => erpUser.id !== erpUserId)
  }

  private async listFromPrisma(clientId: string, employeeId: number): Promise<EmployeeErpUserSummary[]> {
    const prisma = this.requirePrisma()
    await this.requirePrismaEmployee(prisma, clientId, employeeId)

    const rows = await prisma.employeeErpUser.findMany({
      where: { employeeId, clientId },
      select: { id: true, erpId: true, branchId: true },
      orderBy: { id: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      erpId: serializeErpId(row.erpId),
      branchId: row.branchId,
    }))
  }

  private async createFromPrisma(
    clientId: string,
    employeeId: number,
    input: { erpId: number; branchId: number },
  ): Promise<EmployeeErpUserSummary> {
    const prisma = this.requirePrisma()
    await this.requirePrismaEmployee(prisma, clientId, employeeId)

    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, clientId },
      select: { id: true, clientId: true },
    })

    if (branch === null) {
      throw new BadRequestException('Branch not found for current company')
    }

    const existing = await prisma.employeeErpUser.findFirst({
      where: { clientId, erpId: BigInt(input.erpId) },
      select: { id: true, employeeId: true },
    })

    if (existing !== null) {
      throw new ConflictException('ERP user id is already linked for this company')
    }

    const created = await prisma.employeeErpUser.create({
      data: {
        employeeId,
        clientId,
        erpId: BigInt(input.erpId),
        branchId: input.branchId,
      },
      select: { id: true, erpId: true, branchId: true },
    }).catch((error: unknown) => {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('ERP user id is already linked for this company')
      }

      throw error
    })

    return {
      id: created.id,
      erpId: serializeErpId(created.erpId),
      branchId: created.branchId,
    }
  }

  private async removeFromPrisma(clientId: string, employeeId: number, erpUserId: number): Promise<void> {
    const prisma = this.requirePrisma()
    await this.requirePrismaEmployee(prisma, clientId, employeeId)

    const result = await prisma.employeeErpUser.deleteMany({
      where: { id: erpUserId, employeeId, clientId },
    })

    if (result.count === 0) {
      throw new NotFoundException('Employee ERP user not found')
    }
  }

  private requireFixtureEmployee(clientId: string, employeeId: number): EmployeeFixture {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )
    const employee = (this.fixtures?.employees ?? []).find(
      (item) => item.id === employeeId && branchIds.has(item.branchId),
    )

    if (employee === undefined) {
      throw new NotFoundException('Employee not found')
    }

    return employee
  }

  private requireFixtureBranch(clientId: string, branchId: number): BranchFixture {
    const branch = (this.fixtures?.branches ?? []).find(
      (item) => item.id === branchId && item.clientId === clientId,
    )

    if (branch === undefined) {
      throw new BadRequestException('Branch not found for current company')
    }

    return branch
  }

  private assertFixtureErpIdAvailable(clientId: string, erpId: number): void {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )

    const conflict = (this.fixtures?.employees ?? [])
      .filter((employee) => branchIds.has(employee.branchId))
      .flatMap((employee) => employee.erpUsers ?? [])
      .some((erpUser) => Number(erpUser.erpId) === erpId)

    if (conflict) {
      throw new ConflictException('ERP user id is already linked for this company')
    }
  }

  private async requirePrismaEmployee(
    prisma: PrismaEmployeeErpUserClient,
    clientId: string,
    employeeId: number,
  ): Promise<void> {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, branch: { clientId } },
      select: { id: true },
    })

    if (employee === null) {
      throw new NotFoundException('Employee not found')
    }
  }

  private requirePrisma(): PrismaEmployeeErpUserClient {
    if (this.prisma === undefined) {
      throw new Error('PrismaService is required when fixtures are not provided')
    }

    return this.prisma as unknown as PrismaEmployeeErpUserClient
  }
}

function serializeErpId(value: bigint): number {
  const serialized = Number(value)

  if (!Number.isSafeInteger(serialized)) {
    throw new RangeError('Employee erpId exceeds JavaScript safe integer range')
  }

  return serialized
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}
