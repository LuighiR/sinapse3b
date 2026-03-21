import { Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'

type BranchFixture = {
  id: number
  name?: string
  address?: string
  phone?: string
  cnpj?: string
  clientId: string
}

type BranchFixtures = {
  branches?: BranchFixture[]
}

type PrismaBranchReader = {
  branch: {
    findMany(args: unknown): Promise<Array<{
      id: number
      name: string
      address: string
      phone: string
      cnpj: string
      clientId: string
    }>>
  }
}

export type BranchSummary = {
  id: number
  name: string
  address: string
  phone: string
  cnpj: string
  clientId: string
}

@Injectable()
export class BranchesService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: BranchFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async listForClient(clientId: string): Promise<BranchSummary[]> {
    if (this.fixtures !== null) {
      return this.listFromFixtures(clientId)
    }

    return this.listFromPrisma(clientId)
  }

  private listFromFixtures(clientId: string): BranchSummary[] {
    return (this.fixtures?.branches ?? [])
      .filter((branch) => branch.clientId === clientId)
      .sort((left, right) => left.id - right.id)
      .map((branch) => ({
        id: branch.id,
        name: branch.name ?? '',
        address: branch.address ?? '',
        phone: branch.phone ?? '',
        cnpj: branch.cnpj ?? '',
        clientId: branch.clientId,
      }))
  }

  private async listFromPrisma(clientId: string): Promise<BranchSummary[]> {
    if (this.prisma === undefined) {
      return []
    }

    const prisma = this.prisma as unknown as PrismaBranchReader
    return prisma.branch.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        cnpj: true,
        clientId: true,
      },
      orderBy: { id: 'asc' },
    })
  }
}
