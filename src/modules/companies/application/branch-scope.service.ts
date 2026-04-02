import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'

type BranchFixture = {
  id: number
  clientId: string
}

type BranchFixtures = {
  branches?: BranchFixture[]
}

type PrismaBranchReader = {
  branch: {
    findUnique(args: unknown): Promise<{ id: number; clientId: string } | null>
  }
}

@Injectable()
export class BranchScopeService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: BranchFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async assertBranchScope(clientId: string, branchId?: number): Promise<void> {
    if (branchId === undefined) {
      return
    }

    if (this.fixtures !== null) {
      this.assertFromFixtures(clientId, branchId)
      return
    }

    await this.assertFromPrisma(clientId, branchId)
  }

  private assertFromFixtures(clientId: string, branchId: number): void {
    const branch = this.fixtures?.branches?.find((candidate) => candidate.id === branchId)

    if (branch === undefined || branch.clientId !== clientId) {
      throw new ForbiddenException('Branch is outside the active client scope')
    }
  }

  private async assertFromPrisma(clientId: string, branchId: number): Promise<void> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Branch lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaBranchReader
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, clientId: true },
    })

    if (branch === null || branch.clientId !== clientId) {
      throw new ForbiddenException('Branch is outside the active client scope')
    }
  }
}
