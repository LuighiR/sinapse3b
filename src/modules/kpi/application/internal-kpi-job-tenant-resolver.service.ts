import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

type PrismaInternalKpiJobTenantReader = {
  tenant: {
    findUnique(args: unknown): Promise<{
      id: string
      slug: string
      isActive: boolean
      backendClientId: string | null
      backendClient: {
        id: string
        slug: string
        name: string
        isActive: boolean
      } | null
    } | null>
  }
}

export type InternalKpiJobTenant = {
  tenantId: string
  slug: string
  clientId: string
  clientSlug: string
  clientName: string
}

@Injectable()
export class InternalKpiJobTenantResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBySlug(slug: string): Promise<InternalKpiJobTenant> {
    const prisma = this.prisma as unknown as PrismaInternalKpiJobTenantReader
    const normalizedSlug = slug.trim()
    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: {
        id: true,
        slug: true,
        isActive: true,
        backendClientId: true,
        backendClient: {
          select: {
            id: true,
            slug: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (tenant === null || tenant.isActive === false) {
      throw new NotFoundException('Active tenant not found')
    }

    if (tenant.backendClientId === null) {
      throw new ConflictException('Tenant backend client is not configured')
    }

    if (tenant.backendClient === null || tenant.backendClient.isActive === false) {
      throw new ConflictException('Inactive backend client')
    }

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      clientId: tenant.backendClientId,
      clientSlug: tenant.backendClient.slug,
      clientName: tenant.backendClient.name,
    }
  }
}
