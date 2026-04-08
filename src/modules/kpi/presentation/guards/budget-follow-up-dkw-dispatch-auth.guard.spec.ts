import { UnauthorizedException } from '@nestjs/common'
import { BudgetFollowUpDkwDispatchAuthGuard } from './budget-follow-up-dkw-dispatch-auth.guard'

describe('BudgetFollowUpDkwDispatchAuthGuard', () => {
  it('accepts X-Job-Key mode without running jwt or tenant guards', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const jwtAuthGuard = {
      canActivate: jest.fn(),
    }
    const tenantScopeGuard = {
      canActivate: jest.fn(),
    }
    const guard = new BudgetFollowUpDkwDispatchAuthGuard(
      jobKeyAuthorizer as any,
      jwtAuthGuard as any,
      tenantScopeGuard as any,
    )
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-job-key': 'job-secret',
          },
        }),
      }),
    }

    await expect(guard.canActivate(context as never)).resolves.toBe(true)

    expect(jobKeyAuthorizer.assertValid).toHaveBeenCalledWith('job-secret')
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled()
    expect(tenantScopeGuard.canActivate).not.toHaveBeenCalled()
  })

  it('falls back to jwt plus tenant guards when no X-Job-Key is provided', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn(),
    }
    const jwtAuthGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    }
    const tenantScopeGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    }
    const guard = new BudgetFollowUpDkwDispatchAuthGuard(
      jobKeyAuthorizer as any,
      jwtAuthGuard as any,
      tenantScopeGuard as any,
    )
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    }

    await expect(guard.canActivate(context as never)).resolves.toBe(true)

    expect(jobKeyAuthorizer.assertValid).not.toHaveBeenCalled()
    expect(jwtAuthGuard.canActivate).toHaveBeenCalledWith(context)
    expect(tenantScopeGuard.canActivate).toHaveBeenCalledWith(context)
  })

  it('rejects invalid X-Job-Key values', async () => {
    const jobKeyAuthorizer = {
      assertValid: jest.fn().mockImplementation(() => {
        throw new UnauthorizedException('Invalid job key')
      }),
    }
    const guard = new BudgetFollowUpDkwDispatchAuthGuard(
      jobKeyAuthorizer as any,
      { canActivate: jest.fn() } as any,
      { canActivate: jest.fn() } as any,
    )
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-job-key': 'wrong-key',
          },
        }),
      }),
    }

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
