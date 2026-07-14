import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { WhatsAppCitiesService } from './application/whatsapp-cities.service'
import { WhatsAppDepartmentMappingsService } from './application/whatsapp-department-mappings.service'
import { WhatsAppCitiesController } from './presentation/whatsapp-cities.controller'
import { WhatsAppDepartmentMappingsController } from './presentation/whatsapp-department-mappings.controller'

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppCitiesController, WhatsAppDepartmentMappingsController],
  providers: [WhatsAppCitiesService, WhatsAppDepartmentMappingsService],
  exports: [WhatsAppCitiesService, WhatsAppDepartmentMappingsService],
})
export class WhatsAppCitiesModule {}
