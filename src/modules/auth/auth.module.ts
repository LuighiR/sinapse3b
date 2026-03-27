import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { AuthSessionService } from './application/auth-session.service'
import { JwtAuthService } from './application/jwt-auth.service'
import { PasswordHashService } from './application/password-hash.service'
import { RequestContextService } from './application/request-context.service'
import { UserMembershipService } from './application/user-membership.service'
import { AuthContextController } from './presentation/auth-context.controller'
import { AuthSessionController } from './presentation/auth-session.controller'
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from './presentation/guards/tenant-scope.guard'

@Module({
  imports: [PrismaModule],
  controllers: [AuthContextController, AuthSessionController],
  providers: [
    AuthSessionService,
    JwtAuthService,
    PasswordHashService,
    UserMembershipService,
    RequestContextService,
    JwtAuthGuard,
    TenantScopeGuard,
  ],
  exports: [AuthSessionService, JwtAuthService, RequestContextService, UserMembershipService],
})
export class AuthModule {}
