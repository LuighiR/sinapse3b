import { UnauthorizedException } from '@nestjs/common'
import { InternalKpiRefreshJobService } from './internal-kpi-refresh-job.service'

describe('InternalKpiRefreshJobService', () => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
    INTERNAL_JOB_KEY: process.env.INTERNAL_JOB_KEY,
    BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL: process.env.BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL,
    AUTH_REFRESH_JWT_SECRET: process.env.AUTH_REFRESH_JWT_SECRET,
    AUTH_ACCESS_TOKEN_TTL_MINUTES: process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES,
    AUTH_REFRESH_TOKEN_TTL_DAYS: process.env.AUTH_REFRESH_TOKEN_TTL_DAYS,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  }

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app?schema=core'
    process.env.AUTH_JWT_SECRET = 'secret'
    process.env.AUTH_JWT_ISSUER = 'sinapse3'
    process.env.AUTH_JWT_AUDIENCE = 'sinapse3-web'
    process.env.INTERNAL_JOB_KEY = 'job-secret'
    process.env.BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL = ''
    process.env.AUTH_REFRESH_JWT_SECRET = ''
    process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES = '60'
    process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = '30'
    process.env.CORS_ALLOWED_ORIGINS = ''
    process.env.NODE_ENV = 'test'
    process.env.PORT = '3000'
  })

  afterAll(() => {
    restoreEnvValue('DATABASE_URL', originalEnv.DATABASE_URL)
    restoreEnvValue('AUTH_JWT_SECRET', originalEnv.AUTH_JWT_SECRET)
    restoreEnvValue('AUTH_JWT_ISSUER', originalEnv.AUTH_JWT_ISSUER)
    restoreEnvValue('AUTH_JWT_AUDIENCE', originalEnv.AUTH_JWT_AUDIENCE)
    restoreEnvValue('INTERNAL_JOB_KEY', originalEnv.INTERNAL_JOB_KEY)
    restoreEnvValue('BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL', originalEnv.BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL)
    restoreEnvValue('AUTH_REFRESH_JWT_SECRET', originalEnv.AUTH_REFRESH_JWT_SECRET)
    restoreEnvValue('AUTH_ACCESS_TOKEN_TTL_MINUTES', originalEnv.AUTH_ACCESS_TOKEN_TTL_MINUTES)
    restoreEnvValue('AUTH_REFRESH_TOKEN_TTL_DAYS', originalEnv.AUTH_REFRESH_TOKEN_TTL_DAYS)
    restoreEnvValue('CORS_ALLOWED_ORIGINS', originalEnv.CORS_ALLOWED_ORIGINS)
    restoreEnvValue('NODE_ENV', originalEnv.NODE_ENV)
    restoreEnvValue('PORT', originalEnv.PORT)
  })

  it('runs budgets, sales, and calls in order for the resolved backend client', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const tenantResolver = {
      resolveBySlug: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        slug: 'ferracosul-kpi-dev',
        clientId: 'ferracosul',
        clientSlug: 'ferracosul-client',
        clientName: 'Ferracosul',
      }),
    }
    const callOrder: string[] = []
    const budgetRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('budgets')
        return { calculationRunId: '11' }
      }),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('sales')
        return { calculationRunId: '12' }
      }),
    }
    const callRefreshService = {
      refresh: jest.fn().mockImplementation(async () => {
        callOrder.push('calls')
        return { calculationRunId: '13' }
      }),
    }

    const service = new InternalKpiRefreshJobService(
      tenantResolver as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    const result = await service.run({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })

    expect(tenantResolver.resolveBySlug).toHaveBeenCalledWith('ferracosul-kpi-dev')
    expect(budgetRefreshService.refresh).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
    })
    expect(saleRefreshService.refresh).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
    })
    expect(callRefreshService.refresh).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
    })
    expect(callOrder).toEqual(['budgets', 'sales', 'calls'])
    expect(result.slug).toBe('ferracosul-kpi-dev')
    expect(result.clientId).toBe('ferracosul')
    expect(result.overallStatus).toBe('success')
    expect(result.results.map((item: { job: string }) => item.job)).toEqual(['budgets', 'sales', 'calls'])
    expect(result.results.every((item: { status: string }) => item.status === 'success')).toBe(true)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal KPI refresh job started'),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal KPI refresh job finished with success'),
    )

    consoleLogSpy.mockRestore()
  })

  it('continues after failures and returns partial_success', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const tenantResolver = {
      resolveBySlug: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        slug: 'ferracosul-kpi-dev',
        clientId: 'ferracosul',
        clientSlug: 'ferracosul-client',
        clientName: 'Ferracosul',
      }),
    }
    const budgetRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Budget refresh failed')),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockResolvedValue({ calculationRunId: '12' }),
    }
    const callRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Call refresh failed')),
    }

    const service = new InternalKpiRefreshJobService(
      tenantResolver as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    const result = await service.run({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })

    expect(result.overallStatus).toBe('partial_success')
    expect(result.results).toEqual([
      expect.objectContaining({
        job: 'budgets',
        status: 'failed',
        error: 'Budget refresh failed',
      }),
      expect.objectContaining({
        job: 'sales',
        status: 'success',
      }),
      expect.objectContaining({
        job: 'calls',
        status: 'failed',
        error: 'Call refresh failed',
      }),
    ])
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal KPI refresh step failed job=budgets'),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal KPI refresh job finished with partial_success'),
    )

    consoleLogSpy.mockRestore()
  })

  it('returns failed when all refreshes fail', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const tenantResolver = {
      resolveBySlug: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        slug: 'ferracosul-kpi-dev',
        clientId: 'ferracosul',
        clientSlug: 'ferracosul-client',
        clientName: 'Ferracosul',
      }),
    }
    const budgetRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Budget refresh failed')),
    }
    const saleRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Sale refresh failed')),
    }
    const callRefreshService = {
      refresh: jest.fn().mockRejectedValue(new Error('Call refresh failed')),
    }

    const service = new InternalKpiRefreshJobService(
      tenantResolver as any,
      budgetRefreshService as any,
      saleRefreshService as any,
      callRefreshService as any,
    )

    const result = await service.run({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })

    expect(result.overallStatus).toBe('failed')
    expect(result.results.every((item: { status: string }) => item.status === 'failed')).toBe(true)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal KPI refresh job finished with failed'),
    )

    consoleLogSpy.mockRestore()
  })

  it('rejects an invalid job key before execution starts', async () => {
    const tenantResolver = {
      resolveBySlug: jest.fn(),
    }

    const service = new InternalKpiRefreshJobService(
      tenantResolver as any,
      { refresh: jest.fn() } as any,
      { refresh: jest.fn() } as any,
      { refresh: jest.fn() } as any,
    )

    await expect(
      service.run({
        jobKey: 'wrong-key',
        slug: 'ferracosul-kpi-dev',
        from: '2026-04-01',
        to: '2026-04-06',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(tenantResolver.resolveBySlug).not.toHaveBeenCalled()
  })
})

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}
