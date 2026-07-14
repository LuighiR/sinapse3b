import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { WhatsAppCitiesService } from './application/whatsapp-cities.service'
import { WhatsAppCitiesController } from './presentation/whatsapp-cities.controller'

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppCitiesController],
  providers: [WhatsAppCitiesService],
  exports: [WhatsAppCitiesService],
})
export class WhatsAppCitiesModule {}
