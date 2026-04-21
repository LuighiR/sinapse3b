import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { HealthModule } from './modules/health/health.module'
import { MeModule } from './modules/me/me.module'
import { KpiModule } from './modules/kpi/kpi.module'
import { TenantUsersModule } from './modules/tenant-users/tenant-users.module'

@Module({
  imports: [HealthModule, AuthModule, MeModule, CompaniesModule, KpiModule, TenantUsersModule],
})
export class AppModule {}
