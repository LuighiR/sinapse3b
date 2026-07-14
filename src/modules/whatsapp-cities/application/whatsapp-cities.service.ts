import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AuthContext } from '../../auth/domain/auth-context'

export type WhatsAppCitySummary = {
  id: string
  clientId: string
  name: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type CreateWhatsAppCityInput = {
  name: string
}

export type UpdateWhatsAppCityInput = {
  name?: string
  isActive?: boolean
}

export type ListWhatsAppCitiesQuery = {
  activeOnly?: boolean
}

@Injectable()
export class WhatsAppCitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(authContext: AuthContext, query: ListWhatsAppCitiesQuery = {}): Promise<WhatsAppCitySummary[]> {
    return this.prisma.whatsAppCity.findMany({
      where: {
        clientId: authContext.clientId,
        ...(query.activeOnly === true ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    })
  }

  async get(authContext: AuthContext, id: string): Promise<WhatsAppCitySummary> {
    const city = await this.prisma.whatsAppCity.findFirst({
      where: { id, clientId: authContext.clientId },
    })

    if (city === null) {
      throw new NotFoundException('WhatsApp city not found')
    }

    return city
  }

  async create(authContext: AuthContext, input: CreateWhatsAppCityInput): Promise<WhatsAppCitySummary> {
    const existing = await this.prisma.whatsAppCity.findFirst({
      where: {
        clientId: authContext.clientId,
        name: input.name,
      },
    })

    if (existing !== null) {
      throw new ConflictException('WhatsApp city name already exists for this client')
    }

    try {
      return await this.prisma.whatsAppCity.create({
        data: {
          id: randomUUID(),
          clientId: authContext.clientId,
          name: input.name,
          isActive: true,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('WhatsApp city name already exists for this client')
      }

      throw error
    }
  }

  async update(
    authContext: AuthContext,
    id: string,
    input: UpdateWhatsAppCityInput,
  ): Promise<WhatsAppCitySummary> {
    await this.get(authContext, id)

    if (input.name !== undefined) {
      const duplicate = await this.prisma.whatsAppCity.findFirst({
        where: {
          clientId: authContext.clientId,
          name: input.name,
          NOT: { id },
        },
      })

      if (duplicate !== null) {
        throw new ConflictException('WhatsApp city name already exists for this client')
      }
    }

    try {
      return await this.prisma.whatsAppCity.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('WhatsApp city name already exists for this client')
      }

      throw error
    }
  }
}
