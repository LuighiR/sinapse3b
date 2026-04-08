import { BadRequestException } from '@nestjs/common'
import { KpiController } from './kpi.controller'

describe('KpiController', () => {
  const refreshService = {
    refresh: jest.fn(),
  }
  const queryService = {
    getSummary: jest.fn(),
    getDailySeries: jest.fn(),
    getFollowUpSummary: jest.fn(),
    getFollowUpDaily: jest.fn(),
    getFollowUpDrilldown: jest.fn(),
    getHourlySeries: jest.fn(),
    getChannelDaily: jest.fn(),
    getChannelHourly: jest.fn(),
    getChannelAbandonment: jest.fn(),
    getDrilldown: jest.fn(),
  }
  const dkwDispatchService = {
    dispatch: jest.fn(),
  }
  const tenantResolver = {
    resolveBySlug: jest.fn(),
  }

  const controller = new KpiController(
    refreshService as any,
    queryService as any,
    dkwDispatchService as any,
    tenantResolver as any,
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispatches with the authenticated client when using the existing jwt flow', async () => {
    dkwDispatchService.dispatch.mockResolvedValue({ status: 'completed' })

    await expect(
      controller.dispatchFollowUpDkw(
        {
          clientId: 'client-auth',
        } as any,
        undefined,
        {
          from: '2026-04-01',
          to: '2026-04-08',
          referenceAt: '2026-04-08T16:00:00-03:00',
        },
      ),
    ).resolves.toEqual({ status: 'completed' })

    expect(dkwDispatchService.dispatch).toHaveBeenCalledWith({
      clientId: 'client-auth',
      from: '2026-04-01',
      to: '2026-04-08',
      referenceAt: '2026-04-08T16:00:00-03:00',
      sellerId: undefined,
      branchId: undefined,
      orderType: undefined,
      slug: undefined,
    })
    expect(tenantResolver.resolveBySlug).not.toHaveBeenCalled()
  })

  it('dispatches with the resolved backend client when using X-Job-Key and slug', async () => {
    tenantResolver.resolveBySlug.mockResolvedValue({
      tenantId: 'tenant-1',
      slug: 'ferracosul-kpi-dev',
      clientId: 'client-resolved',
      clientSlug: 'ferracosul',
      clientName: 'Ferracosul',
    })
    dkwDispatchService.dispatch.mockResolvedValue({ status: 'completed' })

    await expect(
      controller.dispatchFollowUpDkw(undefined, 'job-secret', {
        slug: 'ferracosul-kpi-dev',
        from: '2026-04-01',
        to: '2026-04-08',
        referenceAt: '2026-04-08T16:00:00-03:00',
      }),
    ).resolves.toEqual({ status: 'completed' })

    expect(tenantResolver.resolveBySlug).toHaveBeenCalledWith('ferracosul-kpi-dev')
    expect(dkwDispatchService.dispatch).toHaveBeenCalledWith({
      clientId: 'client-resolved',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-08',
      referenceAt: '2026-04-08T16:00:00-03:00',
      sellerId: undefined,
      branchId: undefined,
      orderType: undefined,
    })
  })

  it('requires slug when the endpoint is called with X-Job-Key', async () => {
    await expect(
      controller.dispatchFollowUpDkw(undefined, 'job-secret', {
        from: '2026-04-01',
        to: '2026-04-08',
        referenceAt: '2026-04-08T16:00:00-03:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(tenantResolver.resolveBySlug).not.toHaveBeenCalled()
    expect(dkwDispatchService.dispatch).not.toHaveBeenCalled()
  })
})
