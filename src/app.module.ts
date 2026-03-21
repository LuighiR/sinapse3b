import { Module } from '@nestjs/common'
import { AuthModule } from './modules/auth/auth.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { HealthModule } from './modules/health/health.module'
import { MeModule } from './modules/me/me.module'

@Module({
  imports: [HealthModule, AuthModule, MeModule, CompaniesModule],
})
export class AppModule {}
