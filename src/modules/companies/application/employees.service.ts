import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'

type EmployeeFixture = {
  id: number
  name: string
  extensionNumber?: string
  extensionUuid?: string
  chatId?: string
  branchId: number
}

type BranchFixture = {
  id: number
  clientId: string
}

type EmployeeFixtures = {
  branches?: BranchFixture[]
  employees?: EmployeeFixture[]
}

type PrismaEmployeeReader = {
  branch: {
    findUnique(args: unknown): Promise<{ id: number; clientId: string } | null>
  }
    employee: {
      findMany(args: unknown): Promise<Array<{
        id: number
        name: string
        extensionNumber: string
        extensionUuid: string
        chatId: string
        branchId: number
      }>>
    }
  }

export type EmployeeFilters = {
  branchId?: number
  search?: string
}

export type EmployeeSummary = {
  id: number
  name: string
  branchId: number
  extensionNumber: string
  extensionUuid: string
  chatId: string
}

@Injectable()
export class EmployeesService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: EmployeeFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async listForClient(clientId: string, filters: EmployeeFilters): Promise<EmployeeSummary[]> {
    await this.assertBranchScope(clientId, filters.branchId)

    if (this.fixtures !== null) {
      return this.listFromFixtures(clientId, filters)
    }

    return this.listFromPrisma(clientId, filters)
  }

  private async assertBranchScope(clientId: string, branchId?: number): Promise<void> {
    if (branchId === undefined) {
      return
    }

    if (this.fixtures !== null) {
      const branch = this.fixtures?.branches?.find((candidate) => candidate.id === branchId)

      if (branch === undefined || branch.clientId !== clientId) {
        throw new ForbiddenException('Branch is outside the active client scope')
      }

      return
    }

    if (this.prisma === undefined) {
      throw new ForbiddenException('Branch lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaEmployeeReader
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, clientId: true },
    })

    if (branch === null || branch.clientId !== clientId) {
      throw new ForbiddenException('Branch is outside the active client scope')
    }
  }

  private listFromFixtures(clientId: string, filters: EmployeeFilters): EmployeeSummary[] {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )
    const search = filters.search?.toLocaleLowerCase()

    return (this.fixtures?.employees ?? [])
      .filter((employee) => branchIds.has(employee.branchId))
      .filter((employee) => filters.branchId === undefined || employee.branchId === filters.branchId)
      .filter((employee) => search === undefined || employee.name.toLocaleLowerCase().includes(search))
      .sort((left, right) => left.id - right.id)
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        branchId: employee.branchId,
        extensionNumber: employee.extensionNumber ?? '',
        extensionUuid: employee.extensionUuid ?? '',
        chatId: employee.chatId ?? '',
      }))
  }

  private async listFromPrisma(clientId: string, filters: EmployeeFilters): Promise<EmployeeSummary[]> {
    if (this.prisma === undefined) {
      return []
    }

    const prisma = this.prisma as unknown as PrismaEmployeeReader
    return prisma.employee.findMany({
      where: {
        branch: { clientId },
        ...(filters.branchId === undefined ? {} : { branchId: filters.branchId }),
        ...(filters.search === undefined ? {} : { name: { contains: filters.search, mode: 'insensitive' } }),
      },
      select: {
        id: true,
        name: true,
        extensionNumber: true,
        extensionUuid: true,
        chatId: true,
        branchId: true,
      },
      orderBy: { id: 'asc' },
    })
  }
}
