import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../auth/application/user-membership.service'

type CompanyFixture = {
  id: string
  name: string
  slug?: string
  isActive?: boolean
}

type CompanyFixtures = {
  clients?: CompanyFixture[]
}

type PrismaCompanyReader = {
  sinapseClient: {
    findUnique(args: unknown): Promise<{
      id: string
      name: string
      slug: string
      isActive: boolean
    } | null>
  }
}

export type CompanySummary = {
  id: string
  name: string
  slug: string
}

@Injectable()
export class CompaniesService {
  constructor(
    @Optional()
    @Inject(AUTH_TEST_FIXTURES)
    private readonly fixtures: CompanyFixtures | null = null,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  async getCurrentCompany(clientId: string): Promise<CompanySummary> {
    if (this.fixtures !== null) {
      return this.getFromFixtures(clientId)
    }

    return this.getFromPrisma(clientId)
  }

  private getFromFixtures(clientId: string): CompanySummary {
    const client = this.fixtures?.clients?.find((candidate) => candidate.id === clientId)

    if (client === undefined || client.isActive === false) {
      throw new ForbiddenException('Inactive backend client')
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug ?? client.id,
    }
  }

  private async getFromPrisma(clientId: string): Promise<CompanySummary> {
    if (this.prisma === undefined) {
      throw new ForbiddenException('Company lookup is unavailable')
    }

    const prisma = this.prisma as unknown as PrismaCompanyReader
    const client = await prisma.sinapseClient.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, slug: true, isActive: true },
    })

    if (client === null || client.isActive === false) {
      throw new ForbiddenException('Inactive backend client')
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
    }
  }
}
