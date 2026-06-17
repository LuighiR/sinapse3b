import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { isNumericExternalContactId } from './messaging-contact-mapper'
import { normalizePhoneDigits, normalizePhoneForMatch } from './phone-normalization'

@Injectable()
export class DkwContactEnricherService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveLegacyContactId(input: {
    clientId: string
    externalContactId: string
    phoneNormalized: string | null
  }): Promise<bigint | null> {
    if (isNumericExternalContactId(input.externalContactId)) {
      const byId = await this.prisma.contact.findFirst({
        where: {
          clientId: input.clientId,
          id: BigInt(input.externalContactId),
        },
        select: { id: true },
      })

      if (byId != null) {
        return byId.id
      }
    }

    const phoneCandidates = this.buildPhoneCandidates(input.phoneNormalized, input.externalContactId)

    for (const candidate of phoneCandidates) {
      const byPhone = await this.findContactByPhoneDigits(input.clientId, candidate)

      if (byPhone != null) {
        return byPhone
      }
    }

    return null
  }

  private buildPhoneCandidates(
    phoneNormalized: string | null,
    externalContactId: string,
  ): string[] {
    const candidates = new Set<string>()

    for (const value of [phoneNormalized, normalizePhoneForMatch(externalContactId), normalizePhoneDigits(externalContactId)]) {
      if (value != null && value !== '') {
        candidates.add(value)
      }
    }

    return [...candidates]
  }

  private async findContactByPhoneDigits(clientId: string, phoneDigits: string): Promise<bigint | null> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        clientId,
        number: { not: null },
      },
      select: {
        id: true,
        number: true,
      },
    })

    for (const contact of contacts) {
      const contactDigits = normalizePhoneDigits(contact.number)

      if (contactDigits == null) {
        continue
      }

      if (contactDigits === phoneDigits) {
        return contact.id
      }

      const normalizedContact = normalizePhoneForMatch(contactDigits)
      const normalizedCandidate = normalizePhoneForMatch(phoneDigits)

      if (
        normalizedContact != null &&
        normalizedCandidate != null &&
        normalizedContact === normalizedCandidate
      ) {
        return contact.id
      }
    }

    return null
  }
}
