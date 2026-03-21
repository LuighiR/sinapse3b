import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthContext } from '../domain/auth-context'
import { RequestContext } from './decorators/request-context.decorator'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { TenantScopeGuard } from './guards/tenant-scope.guard'

@Controller('auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class AuthContextController {
  @Get('context')
  getContext(@RequestContext() authContext: AuthContext) {
    return {
      user: authContext.user,
      tenant: {
        id: authContext.tenant.id,
        name: authContext.tenant.name,
        slug: authContext.tenant.slug,
      },
      client: authContext.client,
      membership: {
        role: authContext.membership.role,
      },
    }
  }
}
