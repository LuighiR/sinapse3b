import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { FlwMessagingSyncService } from './application/flw-messaging-sync.service'
import { MessagingNormalizationService } from './application/messaging-normalization.service'
import { PrismaFlwRawRepository } from './infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingCanonicalRepository } from './infrastructure/prisma-messaging-canonical.repository'
import { InternalMessagingSyncController } from './presentation/internal-messaging-sync.controller'

@Module({
  imports: [PrismaModule],
  controllers: [InternalMessagingSyncController],
  providers: [
    PrismaFlwRawRepository,
    PrismaMessagingCanonicalRepository,
    MessagingNormalizationService,
    FlwMessagingSyncService,
  ],
  exports: [FlwMessagingSyncService, MessagingNormalizationService],
})
export class MessagingModule {}
