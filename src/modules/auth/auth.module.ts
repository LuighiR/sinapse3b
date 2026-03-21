import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { JwtAuthService } from './application/jwt-auth.service'
import { RequestContextService } from './application/request-context.service'
import { UserMembershipService } from './application/user-membership.service'
import { AuthContextController } from './presentation/auth-context.controller'
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from './presentation/guards/tenant-scope.guard'

@Module({
  imports: [PrismaModule],
  controllers: [AuthContextController],
  providers: [
    JwtAuthService,
    UserMembershipService,
    RequestContextService,
    JwtAuthGuard,
    TenantScopeGuard,
  ],
  exports: [JwtAuthService, RequestContextService, UserMembershipService],
})
export class AuthModule {}
