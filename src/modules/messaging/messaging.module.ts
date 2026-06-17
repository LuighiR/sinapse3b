import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import { DkwContactEnricherService } from './application/dkw-contact-enricher.service'
import { DkwMessagingMigrationJobService } from './application/dkw-messaging-migration-job.service'
import { DkwMessagingMigrationService } from './application/dkw-messaging-migration.service'
import { FlwMessagingSyncService } from './application/flw-messaging-sync.service'
import { MessagingContactService } from './application/messaging-contact.service'
import { MessagingContactsBackfillJobService } from './application/messaging-contacts-backfill-job.service'
import { MessagingContactsBackfillService } from './application/messaging-contacts-backfill.service'
import { MessagingNormalizationService } from './application/messaging-normalization.service'
import { MessagingParityCheckService } from './application/messaging-parity-check.service'
import { FlwWebhookIngestService } from './application/flw-webhook-ingest.service'
import { PrismaDkwLegacyRepository } from './infrastructure/prisma-dkw-legacy.repository'
import { PrismaFlwRawRepository } from './infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingContactRepository } from './infrastructure/prisma-messaging-contact.repository'
import { PrismaMessagingCanonicalRepository } from './infrastructure/prisma-messaging-canonical.repository'
import { FlwWebhookController } from './presentation/flw-webhook.controller'
import { InternalMessagingSyncController } from './presentation/internal-messaging-sync.controller'

@Module({
  imports: [PrismaModule],
  controllers: [InternalMessagingSyncController, FlwWebhookController],
  providers: [
    PrismaFlwRawRepository,
    PrismaDkwLegacyRepository,
    PrismaMessagingCanonicalRepository,
    PrismaMessagingContactRepository,
    DkwContactEnricherService,
    MessagingContactService,
    MessagingContactsBackfillService,
    MessagingContactsBackfillJobService,
    MessagingNormalizationService,
    FlwMessagingSyncService,
    DkwMessagingMigrationService,
    DkwMessagingMigrationJobService,
    MessagingParityCheckService,
    FlwWebhookIngestService,
  ],
  exports: [FlwMessagingSyncService, DkwMessagingMigrationService, MessagingNormalizationService],
})
export class MessagingModule {}
