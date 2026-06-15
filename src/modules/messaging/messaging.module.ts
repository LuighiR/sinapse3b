import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { FlwMessagingSyncService } from './application/flw-messaging-sync.service'
import { MessagingNormalizationService } from './application/messaging-normalization.service'
import { FlwWebhookIngestService } from './application/flw-webhook-ingest.service'
import { PrismaFlwRawRepository } from './infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingCanonicalRepository } from './infrastructure/prisma-messaging-canonical.repository'
import { FlwWebhookController } from './presentation/flw-webhook.controller'
import { InternalMessagingSyncController } from './presentation/internal-messaging-sync.controller'

@Module({
  imports: [PrismaModule],
  controllers: [InternalMessagingSyncController, FlwWebhookController],
  providers: [
    PrismaFlwRawRepository,
    PrismaMessagingCanonicalRepository,
    MessagingNormalizationService,
    FlwMessagingSyncService,
    FlwWebhookIngestService,
  ],
  exports: [FlwMessagingSyncService, MessagingNormalizationService],
})
export class MessagingModule {}
