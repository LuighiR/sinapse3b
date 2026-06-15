import { Injectable } from '@nestjs/common'
import { mapFlwMessageToCanonical, mapFlwSessionToCanonical } from './flw-message-mapper'
import { PrismaFlwRawRepository } from '../infrastructure/prisma-flw-raw.repository'
import { PrismaMessagingCanonicalRepository } from '../infrastructure/prisma-messaging-canonical.repository'

export type MessagingNormalizationResult = {
  sessionsWritten: number
  messagesWritten: number
}

@Injectable()
export class MessagingNormalizationService {
  constructor(
    private readonly rawRepository: PrismaFlwRawRepository,
    private readonly canonicalRepository: PrismaMessagingCanonicalRepository,
  ) {}

  async normalizeClient(clientId: string): Promise<MessagingNormalizationResult> {
    const branchIdByDepartmentId = await this.canonicalRepository.loadBranchIdByDepartmentId(clientId)
    const sessions = await this.rawRepository.listSessionsByClientId(clientId)
    const messages = await this.rawRepository.listMessagesByClientId(clientId)

    const sessionIdByExternalId = new Map<string, string>()

    for (const session of sessions) {
      const payload = mapFlwSessionToCanonical({
        clientId,
        session,
        branchIdByDepartmentId,
      })

      await this.canonicalRepository.upsertSession(payload)
      sessionIdByExternalId.set(session.id, payload.id)
    }

    let messagesWritten = 0

    for (const message of messages) {
      const sessionCanonicalId = sessionIdByExternalId.get(message.sessionId)

      if (sessionCanonicalId == null) {
        continue
      }

      const payload = mapFlwMessageToCanonical({
        clientId,
        sessionCanonicalId,
        message,
      })

      await this.canonicalRepository.upsertMessage(payload)
      messagesWritten += 1
    }

    return {
      sessionsWritten: sessions.length,
      messagesWritten,
    }
  }
}
