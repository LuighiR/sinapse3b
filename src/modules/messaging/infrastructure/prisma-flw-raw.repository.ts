import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { FlwMessageDto, FlwSessionDto } from '../domain/messaging-types'

@Injectable()
export class PrismaFlwRawRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertSession(input: {
    clientId: string
    session: FlwSessionDto
    source: string
  }): Promise<void> {
    await this.prisma.flwSessionRaw.upsert({
      where: { id: input.session.id },
      create: {
        id: input.session.id,
        clientId: input.clientId,
        payloadJson: input.session as unknown as Prisma.InputJsonValue,
        source: input.source,
      },
      update: {
        payloadJson: input.session as unknown as Prisma.InputJsonValue,
        source: input.source,
        fetchedAt: new Date(),
      },
    })
  }

  async upsertMessage(input: {
    clientId: string
    message: FlwMessageDto
    source: string
  }): Promise<void> {
    await this.prisma.flwMessageRaw.upsert({
      where: { id: input.message.id },
      create: {
        id: input.message.id,
        clientId: input.clientId,
        sessionId: input.message.sessionId,
        payloadJson: input.message as unknown as Prisma.InputJsonValue,
        source: input.source,
      },
      update: {
        payloadJson: input.message as unknown as Prisma.InputJsonValue,
        source: input.source,
        fetchedAt: new Date(),
      },
    })
  }

  async listSessionsByClientId(clientId: string): Promise<FlwSessionDto[]> {
    const rows = await this.prisma.flwSessionRaw.findMany({
      where: { clientId },
      orderBy: { fetchedAt: 'asc' },
    })

    return rows.map((row) => row.payloadJson as unknown as FlwSessionDto)
  }

  async listMessagesByClientId(clientId: string): Promise<FlwMessageDto[]> {
    const rows = await this.prisma.flwMessageRaw.findMany({
      where: { clientId },
      orderBy: { fetchedAt: 'asc' },
    })

    return rows.map((row) => row.payloadJson as unknown as FlwMessageDto)
  }
}
