import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { TenantUsersService } from '../application/tenant-users.service'
import { parseCreateTenantUserBody } from './body/create-tenant-user.body'
import { parseUpdateTenantUserBody } from './body/update-tenant-user.body'

@Controller('tenant-users')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class TenantUsersController {
  constructor(private readonly tenantUsersService: TenantUsersService) {}

  @Get()
  list(@RequestContext() authContext: AuthContext) {
    return this.tenantUsersService.listForTenant(authContext)
  }

  @Post()
  create(@RequestContext() authContext: AuthContext, @Body() body: Record<string, unknown>) {
    return this.tenantUsersService.createForTenant(authContext, parseCreateTenantUserBody(body))
  }

  @Patch(':userId')
  update(
    @RequestContext() authContext: AuthContext,
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.tenantUsersService.updateForTenant(authContext, userId, parseUpdateTenantUserBody(body))
  }
}
