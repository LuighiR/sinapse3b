import { ConflictException, NotFoundException } from '@nestjs/common'
import { InternalKpiJobTenantResolverService } from './internal-kpi-job-tenant-resolver.service'

describe('InternalKpiJobTenantResolverService', () => {
  it('resolves an active tenant and backend client by slug', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          slug: 'ferracosul-kpi-dev',
          isActive: true,
          backendClientId: 'ferracosul',
          backendClient: {
            id: 'ferracosul',
            slug: 'ferracosul-client',
            name: 'Ferracosul',
            isActive: true,
          },
        }),
      },
    }

    const service = new InternalKpiJobTenantResolverService(prisma as any)

    await expect(service.resolveBySlug('ferracosul-kpi-dev')).resolves.toEqual({
      tenantId: 'tenant-1',
      slug: 'ferracosul-kpi-dev',
      clientId: 'ferracosul',
      clientSlug: 'ferracosul-client',
      clientName: 'Ferracosul',
    })
  })

  it('throws NotFoundException when the tenant slug is unknown', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    }

    const service = new InternalKpiJobTenantResolverService(prisma as any)

    await expect(service.resolveBySlug('missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('throws NotFoundException when the tenant is inactive', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          slug: 'ferracosul-kpi-dev',
          isActive: false,
          backendClientId: 'ferracosul',
          backendClient: {
            id: 'ferracosul',
            slug: 'ferracosul-client',
            name: 'Ferracosul',
            isActive: true,
          },
        }),
      },
    }

    const service = new InternalKpiJobTenantResolverService(prisma as any)

    await expect(service.resolveBySlug('ferracosul-kpi-dev')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('throws ConflictException when the tenant has no backend client id', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          slug: 'ferracosul-kpi-dev',
          isActive: true,
          backendClientId: null,
          backendClient: null,
        }),
      },
    }

    const service = new InternalKpiJobTenantResolverService(prisma as any)

    await expect(service.resolveBySlug('ferracosul-kpi-dev')).rejects.toBeInstanceOf(ConflictException)
  })

  it('throws ConflictException when the backend client is inactive', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          slug: 'ferracosul-kpi-dev',
          isActive: true,
          backendClientId: 'ferracosul',
          backendClient: {
            id: 'ferracosul',
            slug: 'ferracosul-client',
            name: 'Ferracosul',
            isActive: false,
          },
        }),
      },
    }

    const service = new InternalKpiJobTenantResolverService(prisma as any)

    await expect(service.resolveBySlug('ferracosul-kpi-dev')).rejects.toBeInstanceOf(ConflictException)
  })
})
