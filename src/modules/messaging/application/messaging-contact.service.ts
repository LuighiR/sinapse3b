import { Injectable } from '@nestjs/common'
import { MessagingContactWritePayload } from '../domain/messaging-contact-types'
import { MessagingSessionWritePayload } from '../domain/messaging-types'
import { DkwContactEnricherService } from './dkw-contact-enricher.service'
import { mapSessionToMessagingContact } from './messaging-contact-mapper'
import { PrismaMessagingContactRepository } from '../infrastructure/prisma-messaging-contact.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'

@Injectable()
export class MessagingContactService {
  constructor(
    private readonly contactRepository: PrismaMessagingContactRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
    private readonly dkwContactEnricher: DkwContactEnricherService,
  ) {}

  async upsertSessionWithContact(session: MessagingSessionWritePayload): Promise<void> {
    const contactPayload = await this.buildContactPayload(session)

    if (contactPayload != null) {
      await this.contactRepository.upsertContact(contactPayload)
    }

    await this.canonicalRepository.upsertSession({
      ...session,
      contactId: contactPayload?.id ?? null,
    })
  }

  async upsertContactFromSession(session: MessagingSessionWritePayload): Promise<MessagingContactWritePayload | null> {
    const contactPayload = await this.buildContactPayload(session)

    if (contactPayload == null) {
      return null
    }

    await this.contactRepository.upsertContact(contactPayload)

    return contactPayload
  }

  private async buildContactPayload(
    session: MessagingSessionWritePayload,
  ): Promise<MessagingContactWritePayload | null> {
    const basePayload = mapSessionToMessagingContact({ session })

    if (basePayload == null) {
      return null
    }

    if (session.provider !== 'DKW') {
      return basePayload
    }

    const legacyContactId = await this.dkwContactEnricher.resolveLegacyContactId({
      clientId: session.clientId,
      externalContactId: basePayload.externalContactId,
      phoneNormalized: basePayload.phoneNormalized,
    })

    return {
      ...basePayload,
      legacyContactId,
    }
  }
}
