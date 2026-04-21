import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { TenantUsersService } from './application/tenant-users.service'
import { TenantUsersController } from './presentation/tenant-users.controller'

@Module({
  imports: [AuthModule],
  controllers: [TenantUsersController],
  providers: [TenantUsersService],
})
export class TenantUsersModule {}
