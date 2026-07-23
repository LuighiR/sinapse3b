import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'
import { AuthContext } from '../../auth/domain/auth-context'
import { BranchScopeService } from './branch-scope.service'

type MembershipRole = AuthContext['membership']['role']

type EmployeeFixture = {
  id: number
  name: string
  extensionNumber?: string | null
  extensionUuid?: string | null
  erpId?: bigint | number
  chatId?: string | null
  isNonCommercial?: boolean
  isActive?: boolean
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

type EmployeeRecord = {
  id: number
  name: string
  extensionNumber: string | null
  extensionUuid: string | null
  erpId: bigint
  chatId: string | null
  isNonCommercial: boolean
  isActive: boolean
  branchId: number
}

type PrismaEmployeeStore = {
  employee: {
    findMany(args: unknown): Promise<EmployeeRecord[]>
    findFirst(args: unknown): Promise<EmployeeRecord | null>
    create(args: unknown): Promise<EmployeeRecord>
    update(args: unknown): Promise<EmployeeRecord>
  }
  branch: {
    findFirst(args: unknown): Promise<{ id: number; clientId: string } | null>
  }
}

export type EmployeeFilters = {
  branchId?: number
  search?: string
  includeInactive?: boolean
}

export type EmployeeSummary = {
  id: number
  erpId: number
  name: string
  branchId: number
  extensionNumber: string | null
  extensionUuid: string | null
  chatId: string | null
  isNonCommercial: boolean
  isActive: boolean
}

export type CreateEmployeeInput = {
  name: string
  branchId: number
  erpId: number
  extensionNumber?: string | null
  extensionUuid?: string | null
  chatId?: string | null
  isNonCommercial?: boolean
  isActive?: boolean
}

export type UpdateEmployeeInput = {
  name?: string
  branchId?: number
  erpId?: number
  extensionNumber?: string | null
  extensionUuid?: string | null
  chatId?: string | null
  isNonCommercial?: boolean
  isActive?: boolean
}

const MANAGE_ROLES: ReadonlySet<MembershipRole> = new Set(['OWNER', 'ADMIN', 'MANAGER'])

const employeeSelect = {
  id: true,
  name: true,
  extensionNumber: true,
  extensionUuid: true,
  erpId: true,
  chatId: true,
  isNonCommercial: true,
  isActive: true,
  branchId: true,
} as const

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

  async listForClient(authContext: AuthContext, filters: EmployeeFilters): Promise<EmployeeSummary[]> {
    if (this.branchScopeService !== undefined) {
      await this.branchScopeService.assertBranchScope(authContext.clientId, filters.branchId)
    }

    const includeInactive = this.canIncludeInactive(authContext.membership.role, filters.includeInactive)

    if (this.fixtures !== null) {
      return this.listFromFixtures(authContext.clientId, filters, includeInactive)
    }

    return this.listFromPrisma(authContext.clientId, filters, includeInactive)
  }

  async createForClient(authContext: AuthContext, input: CreateEmployeeInput): Promise<EmployeeSummary> {
    this.assertManagePermission(authContext)

    if (this.fixtures !== null) {
      return this.createFromFixtures(authContext.clientId, input)
    }

    return this.createFromPrisma(authContext.clientId, input)
  }

  async updateForClient(
    authContext: AuthContext,
    employeeId: number,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeSummary> {
    this.assertManagePermission(authContext)

    if (this.fixtures !== null) {
      return this.updateFromFixtures(authContext.clientId, employeeId, input)
    }

    return this.updateFromPrisma(authContext.clientId, employeeId, input)
  }

  private assertManagePermission(authContext: AuthContext): void {
    if (!MANAGE_ROLES.has(authContext.membership.role)) {
      throw new ForbiddenException('Employee administration requires owner, admin, or manager membership')
    }
  }

  private canIncludeInactive(role: MembershipRole, includeInactive?: boolean): boolean {
    return includeInactive === true && MANAGE_ROLES.has(role)
  }

  private listFromFixtures(
    clientId: string,
    filters: EmployeeFilters,
    includeInactive: boolean,
  ): EmployeeSummary[] {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )
    const search = filters.search?.toLocaleLowerCase()

    return (this.fixtures?.employees ?? [])
      .filter((employee) => branchIds.has(employee.branchId))
      .filter((employee) => filters.branchId === undefined || employee.branchId === filters.branchId)
      .filter((employee) => includeInactive || (employee.isActive ?? true))
      .filter((employee) => search === undefined || employee.name.toLocaleLowerCase().includes(search))
      .sort((left, right) => left.id - right.id)
      .map((employee) => this.toSummaryFromFixture(employee))
  }

  private createFromFixtures(clientId: string, input: CreateEmployeeInput): EmployeeSummary {
    this.assertBranchInFixtures(clientId, input.branchId)
    this.assertUniquenessInFixtures(clientId, {
      erpId: input.erpId,
      extensionUuid: normalizeOptionalText(input.extensionUuid),
      chatId: normalizeOptionalText(input.chatId),
    })

    if (this.fixtures === null) {
      throw new ForbiddenException('Employee fixtures are unavailable')
    }

    if (this.fixtures.employees === undefined) {
      this.fixtures.employees = []
    }

    const employees = this.fixtures.employees
    const nextId = employees.reduce((max, employee) => Math.max(max, employee.id), 0) + 1
    const created: EmployeeFixture = {
      id: nextId,
      name: input.name,
      branchId: input.branchId,
      erpId: input.erpId,
      extensionNumber: normalizeOptionalText(input.extensionNumber),
      extensionUuid: normalizeOptionalText(input.extensionUuid),
      chatId: normalizeOptionalText(input.chatId),
      isNonCommercial: input.isNonCommercial ?? false,
      isActive: input.isActive ?? true,
    }
    employees.push(created)
    return this.toSummaryFromFixture(created)
  }

  private updateFromFixtures(clientId: string, employeeId: number, input: UpdateEmployeeInput): EmployeeSummary {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )
    const employee = (this.fixtures?.employees ?? []).find(
      (candidate) => candidate.id === employeeId && branchIds.has(candidate.branchId),
    )

    if (employee === undefined) {
      throw new NotFoundException('Employee not found')
    }

    if (input.branchId !== undefined) {
      this.assertBranchInFixtures(clientId, input.branchId)
    }

    const nextErpId =
      input.erpId !== undefined ? input.erpId : serializeErpId(toBigInt(employee.erpId ?? employee.id))
    const nextExtensionUuid =
      input.extensionUuid !== undefined
        ? normalizeOptionalText(input.extensionUuid)
        : normalizeOptionalText(employee.extensionUuid)
    const nextChatId =
      input.chatId !== undefined ? normalizeOptionalText(input.chatId) : normalizeOptionalText(employee.chatId)

    this.assertUniquenessInFixtures(
      clientId,
      {
        erpId: nextErpId,
        extensionUuid: nextExtensionUuid,
        chatId: nextChatId,
      },
      employee.id,
    )

    if (input.branchId !== undefined) {
      employee.branchId = input.branchId
    }

    if (input.name !== undefined) {
      employee.name = input.name
    }

    if (input.erpId !== undefined) {
      employee.erpId = input.erpId
    }

    if (input.extensionNumber !== undefined) {
      employee.extensionNumber = normalizeOptionalText(input.extensionNumber)
    }

    if (input.extensionUuid !== undefined) {
      employee.extensionUuid = nextExtensionUuid
    }

    if (input.chatId !== undefined) {
      employee.chatId = nextChatId
    }

    if (input.isNonCommercial !== undefined) {
      employee.isNonCommercial = input.isNonCommercial
    }

    if (input.isActive !== undefined) {
      employee.isActive = input.isActive
    }

    return this.toSummaryFromFixture(employee)
  }

  private assertBranchInFixtures(clientId: string, branchId: number): void {
    const branch = this.fixtures?.branches?.find((candidate) => candidate.id === branchId)

    if (branch === undefined || branch.clientId !== clientId) {
      throw new BadRequestException('Branch is outside the active client scope')
    }
  }

  private assertUniquenessInFixtures(
    clientId: string,
    values: { erpId: number; extensionUuid: string | null; chatId: string | null },
    excludeEmployeeId?: number,
  ): void {
    const branchIds = new Set(
      (this.fixtures?.branches ?? [])
        .filter((branch) => branch.clientId === clientId)
        .map((branch) => branch.id),
    )

    for (const employee of this.fixtures?.employees ?? []) {
      if (!branchIds.has(employee.branchId)) {
        continue
      }

      if (excludeEmployeeId !== undefined && employee.id === excludeEmployeeId) {
        continue
      }

      if (serializeErpId(toBigInt(employee.erpId ?? employee.id)) === values.erpId) {
        throw new ConflictException('Employee erpId already in use for this company')
      }

      const extensionUuid = normalizeOptionalText(employee.extensionUuid)
      if (values.extensionUuid !== null && extensionUuid === values.extensionUuid) {
        throw new ConflictException('Employee extensionUuid already in use for this company')
      }

      const chatId = normalizeOptionalText(employee.chatId)
      if (values.chatId !== null && chatId === values.chatId) {
        throw new ConflictException('Employee chatId already in use for this company')
      }
    }
  }

  private async listFromPrisma(
    clientId: string,
    filters: EmployeeFilters,
    includeInactive: boolean,
  ): Promise<EmployeeSummary[]> {
    if (this.prisma === undefined) {
      return []
    }

    const prisma = this.prisma as unknown as PrismaEmployeeStore
    const employees = await prisma.employee.findMany({
      where: {
        branch: { clientId },
        ...(filters.branchId === undefined ? {} : { branchId: filters.branchId }),
        ...(includeInactive ? {} : { isActive: true }),
        ...(filters.search === undefined ? {} : { name: { contains: filters.search, mode: 'insensitive' } }),
      },
      select: employeeSelect,
      orderBy: { id: 'asc' },
    })

    return employees.map((employee) => this.toSummary(employee))
  }

  private async createFromPrisma(clientId: string, input: CreateEmployeeInput): Promise<EmployeeSummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Employee persistence is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaEmployeeStore
    await this.assertBranchInPrisma(prisma, clientId, input.branchId)

    const extensionNumber = normalizeOptionalText(input.extensionNumber)
    const extensionUuid = normalizeOptionalText(input.extensionUuid)
    const chatId = normalizeOptionalText(input.chatId)

    await this.assertUniquenessInPrisma(prisma, clientId, {
      erpId: input.erpId,
      extensionUuid,
      chatId,
    })

    try {
      const created = await prisma.employee.create({
        data: {
          name: input.name,
          branchId: input.branchId,
          erpId: BigInt(input.erpId),
          extensionNumber,
          extensionUuid,
          chatId,
          isNonCommercial: input.isNonCommercial ?? false,
          isActive: input.isActive ?? true,
        },
        select: employeeSelect,
      })

      return this.toSummary(created)
    } catch (error) {
      this.rethrowUniqueConflict(error)
      throw error
    }
  }

  private async updateFromPrisma(
    clientId: string,
    employeeId: number,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeSummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Employee persistence is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaEmployeeStore
    const existing = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        branch: { clientId },
      },
      select: employeeSelect,
    })

    if (existing === null) {
      throw new NotFoundException('Employee not found')
    }

    if (input.branchId !== undefined) {
      await this.assertBranchInPrisma(prisma, clientId, input.branchId)
    }

    const nextErpId = input.erpId ?? serializeErpId(existing.erpId)
    const nextExtensionUuid =
      input.extensionUuid !== undefined ? normalizeOptionalText(input.extensionUuid) : existing.extensionUuid
    const nextChatId = input.chatId !== undefined ? normalizeOptionalText(input.chatId) : existing.chatId

    await this.assertUniquenessInPrisma(
      prisma,
      clientId,
      {
        erpId: nextErpId,
        extensionUuid: nextExtensionUuid,
        chatId: nextChatId,
      },
      employeeId,
    )

    try {
      const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.branchId === undefined ? {} : { branchId: input.branchId }),
          ...(input.erpId === undefined ? {} : { erpId: BigInt(input.erpId) }),
          ...(input.extensionNumber === undefined
            ? {}
            : { extensionNumber: normalizeOptionalText(input.extensionNumber) }),
          ...(input.extensionUuid === undefined ? {} : { extensionUuid: nextExtensionUuid }),
          ...(input.chatId === undefined ? {} : { chatId: nextChatId }),
          ...(input.isNonCommercial === undefined ? {} : { isNonCommercial: input.isNonCommercial }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        select: employeeSelect,
      })

      return this.toSummary(updated)
    } catch (error) {
      this.rethrowUniqueConflict(error)
      throw error
    }
  }

  private async assertBranchInPrisma(
    prisma: PrismaEmployeeStore,
    clientId: string,
    branchId: number,
  ): Promise<void> {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, clientId },
      select: { id: true, clientId: true },
    })

    if (branch === null) {
      throw new BadRequestException('Branch is outside the active client scope')
    }
  }

  private async assertUniquenessInPrisma(
    prisma: PrismaEmployeeStore,
    clientId: string,
    values: { erpId: number; extensionUuid: string | null; chatId: string | null },
    excludeEmployeeId?: number,
  ): Promise<void> {
    const exclude = excludeEmployeeId === undefined ? {} : { id: { not: excludeEmployeeId } }

    const erpConflict = await prisma.employee.findFirst({
      where: {
        ...exclude,
        erpId: BigInt(values.erpId),
        branch: { clientId },
      },
      select: employeeSelect,
    })

    if (erpConflict !== null) {
      throw new ConflictException('Employee erpId already in use for this company')
    }

    if (values.extensionUuid !== null) {
      const extensionConflict = await prisma.employee.findFirst({
        where: {
          ...exclude,
          extensionUuid: values.extensionUuid,
          branch: { clientId },
        },
        select: employeeSelect,
      })

      if (extensionConflict !== null) {
        throw new ConflictException('Employee extensionUuid already in use for this company')
      }
    }

    if (values.chatId !== null) {
      const chatConflict = await prisma.employee.findFirst({
        where: {
          ...exclude,
          chatId: values.chatId,
          branch: { clientId },
        },
        select: employeeSelect,
      })

      if (chatConflict !== null) {
        throw new ConflictException('Employee chatId already in use for this company')
      }
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : []

    if (target.some((field) => field.includes('extension_uuid'))) {
      throw new ConflictException('Employee extensionUuid already in use for this company')
    }

    if (target.some((field) => field.includes('chat_id'))) {
      throw new ConflictException('Employee chatId already in use for this company')
    }

    throw new ConflictException('Employee erpId already in use for this company')
  }

  private toSummary(employee: EmployeeRecord): EmployeeSummary {
    return {
      id: employee.id,
      erpId: serializeErpId(employee.erpId),
      name: employee.name,
      branchId: employee.branchId,
      extensionNumber: normalizeOptionalText(employee.extensionNumber),
      extensionUuid: normalizeOptionalText(employee.extensionUuid),
      chatId: normalizeOptionalText(employee.chatId),
      isNonCommercial: employee.isNonCommercial,
      isActive: employee.isActive,
    }
  }

  private toSummaryFromFixture(employee: EmployeeFixture): EmployeeSummary {
    return {
      id: employee.id,
      erpId: serializeErpId(toBigInt(employee.erpId ?? employee.id)),
      name: employee.name,
      branchId: employee.branchId,
      extensionNumber: normalizeOptionalText(employee.extensionNumber),
      extensionUuid: normalizeOptionalText(employee.extensionUuid),
      chatId: normalizeOptionalText(employee.chatId),
      isNonCommercial: employee.isNonCommercial ?? false,
      isActive: employee.isActive ?? true,
    }
  }
}

function serializeErpId(value: bigint): number {
  const serialized = Number(value)

  if (!Number.isSafeInteger(serialized)) {
    throw new RangeError('Employee erpId exceeds JavaScript safe integer range')
  }

  return serialized
}

function toBigInt(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value)
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
