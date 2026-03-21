import { UnauthorizedException } from '@nestjs/common'
import { RequestContextService } from '../../application/request-context.service'
import { TenantScopeGuard } from './tenant-scope.guard'

describe('TenantScopeGuard', () => {
  it('throws UnauthorizedException when auth claims are missing', async () => {
    const guard = new TenantScopeGuard({ resolve: jest.fn() } as unknown as RequestContextService)

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-tenant-id': 't1' },
        }),
      }),
    }

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
