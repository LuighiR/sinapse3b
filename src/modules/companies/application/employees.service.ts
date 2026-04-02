import { Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'
import { BranchScopeService } from './branch-scope.service'

type EmployeeFixture = {
  id: number
  name: string
  extensionNumber?: string
  extensionUuid?: string
  erpId?: bigint
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
  employee: {
    findMany(args: unknown): Promise<
      Array<{
        id: number
        name: string
        extensionNumber: string
        extensionUuid: string
        erpId: bigint
        chatId: string
        branchId: number
      }>
    >
  }
}

export type EmployeeFilters = {
  branchId?: number
  search?: string
}

export type EmployeeSummary = {
  id: number
  erpId: number
  name: string
  branchId: number
  extensionNumber: string
  extensionUuid: string
  chatId: string
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly branchScopeService?: BranchScopeService,
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: EmployeeFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async listForClient(clientId: string, filters: EmployeeFilters): Promise<EmployeeSummary[]> {
    if (this.branchScopeService !== undefined) {
      await this.branchScopeService.assertBranchScope(clientId, filters.branchId)
    }

    if (this.fixtures !== null) {
      return this.listFromFixtures(clientId, filters)
    }

    return this.listFromPrisma(clientId, filters)
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
        erpId: serializeErpId(employee.erpId ?? BigInt(employee.id)),
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
    const employees = await prisma.employee.findMany({
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
        erpId: true,
        chatId: true,
        branchId: true,
      },
      orderBy: { id: 'asc' },
    })

    return employees.map((employee) => ({
      ...employee,
      erpId: serializeErpId(employee.erpId),
    }))
  }
}

function serializeErpId(value: bigint): number {
  const serialized = Number(value)

  if (!Number.isSafeInteger(serialized)) {
    throw new RangeError('Employee erpId exceeds JavaScript safe integer range')
  }

  return serialized
}
