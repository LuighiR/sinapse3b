import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { KpiPeriod } from '../../kpi/domain/kpi-period'
import {
  MessagingContactWritePayload,
  MessagingSessionContactKey,
} from '../domain/messaging-contact-types'
import { MessagingProviderValue } from '../domain/messaging-types'

type DistinctContactKeyRow = {
  client_id: string
  provider: MessagingProviderValue
  contact_external_id: string
}

@Injectable()
export class PrismaMessagingContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertContact(payload: MessagingContactWritePayload): Promise<void> {
    await this.prisma.messagingContact.upsert({
      where: { id: payload.id },
      create: {
        id: payload.id,
        clientId: payload.clientId,
        provider: payload.provider,
        externalContactId: payload.externalContactId,
        displayName: payload.displayName,
        phoneNormalized: payload.phoneNormalized,
        legacyContactId: payload.legacyContactId,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
      update: {
        displayName: payload.displayName,
        phoneNormalized: payload.phoneNormalized,
        legacyContactId: payload.legacyContactId,
        rawJson: payload.rawJson as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async listDistinctSessionContactKeys(
    clientId: string,
    period?: KpiPeriod,
  ): Promise<MessagingSessionContactKey[]> {
    const toExclusive =
      period == null
        ? null
        : (() => {
            const next = new Date(period.to.getTime())
            next.setUTCDate(next.getUTCDate() + 1)
            return next
          })()

    const rows = await this.prisma.$queryRaw<DistinctContactKeyRow[]>(Prisma.sql`
      select distinct
        ms.client_id,
        ms.provider,
        ms.contact_external_id
      from core.messaging_sessions ms
      where ms.client_id = ${clientId}
        and ms.contact_external_id is not null
        and btrim(ms.contact_external_id) <> ''
        ${period == null || toExclusive == null
          ? Prisma.empty
          : Prisma.sql`
            and ms.started_at >= ${period.from}
            and ms.started_at < ${toExclusive}
          `}
      order by ms.provider asc, ms.contact_external_id asc
    `)

    return rows.map((row) => ({
      clientId: row.client_id,
      provider: row.provider,
      contactExternalId: row.contact_external_id,
    }))
  }

  async linkSessionsToContact(input: {
    clientId: string
    provider: MessagingProviderValue
    contactExternalId: string
    contactId: string
  }): Promise<number> {
    const result = await this.prisma.messagingSession.updateMany({
      where: {
        clientId: input.clientId,
        provider: input.provider,
        contactExternalId: input.contactExternalId,
        OR: [{ contactId: null }, { contactId: { not: input.contactId } }],
      },
      data: {
        contactId: input.contactId,
      },
    })

    return result.count
  }
}
