import { Injectable } from '@nestjs/common'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import { buildCanonicalMessagingContactId } from '../domain/messaging-contact-types'
import { PrismaMessagingContactRepository } from '../infrastructure/prisma-messaging-contact.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'
import { MessagingContactService } from './messaging-contact.service'

export type MessagingContactsBackfillResult = {
  clientId: string
  from: string | null
  to: string | null
  distinctContactKeys: number
  contactsWritten: number
  sessionsLinked: number
}

@Injectable()
export class MessagingContactsBackfillService {
  constructor(
    private readonly contactRepository: PrismaMessagingContactRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
    private readonly contactService: MessagingContactService,
  ) {}

  async backfillClient(input: {
    clientId: string
    period?: KpiPeriod
  }): Promise<MessagingContactsBackfillResult> {
    const { clientId, period } = input
    const keys = await this.contactRepository.listDistinctSessionContactKeys(clientId, period)
    let contactsWritten = 0
    let sessionsLinked = 0

    for (const key of keys) {
      const sampleSession = await this.canonicalRepository.findSampleSessionByContactKey(key)

      if (sampleSession == null) {
        continue
      }

      const contactPayload = await this.contactService.upsertContactFromSession(sampleSession)

      if (contactPayload == null) {
        continue
      }

      contactsWritten += 1

      sessionsLinked += await this.contactRepository.linkSessionsToContact({
        clientId: key.clientId,
        provider: key.provider,
        contactExternalId: key.contactExternalId,
        contactId: buildCanonicalMessagingContactId(
          key.clientId,
          key.provider,
          key.contactExternalId,
        ),
      })
    }

    return {
      clientId,
      from: period == null ? null : KpiPeriod.formatDateKey(period.from),
      to: period == null ? null : KpiPeriod.formatDateKey(period.to),
      distinctContactKeys: keys.length,
      contactsWritten,
      sessionsLinked,
    }
  }
}
