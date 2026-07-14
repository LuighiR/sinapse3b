import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { WhatsAppDepartmentMappingStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AuthContext } from '../../auth/domain/auth-context'

export type WhatsAppDepartmentMappingSummary = {
  id: string
  clientId: string
  departmentId: string
  departmentLabel: string | null
  cityId: string | null
  status: WhatsAppDepartmentMappingStatus
  createdAt: Date
  updatedAt: Date
}

export type CreateWhatsAppDepartmentMappingInput = {
  departmentId: string
  departmentLabel?: string | null
  cityId?: string | null
}

export type UpdateWhatsAppDepartmentMappingInput = {
  departmentLabel?: string | null
  cityId?: string | null
  status?: WhatsAppDepartmentMappingStatus
}

export type ListWhatsAppDepartmentMappingsQuery = {
  status?: WhatsAppDepartmentMappingStatus
}

@Injectable()
export class WhatsAppDepartmentMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    authContext: AuthContext,
    query: ListWhatsAppDepartmentMappingsQuery = {},
  ): Promise<WhatsAppDepartmentMappingSummary[]> {
    return this.prisma.whatsAppDepartmentMapping.findMany({
      where: {
        clientId: authContext.clientId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      orderBy: { departmentId: 'asc' },
    })
  }

  async get(authContext: AuthContext, id: string): Promise<WhatsAppDepartmentMappingSummary> {
    const mapping = await this.prisma.whatsAppDepartmentMapping.findFirst({
      where: { id, clientId: authContext.clientId },
    })

    if (mapping === null) {
      throw new NotFoundException('WhatsApp department mapping not found')
    }

    return mapping
  }

  async create(
    authContext: AuthContext,
    input: CreateWhatsAppDepartmentMappingInput,
  ): Promise<WhatsAppDepartmentMappingSummary> {
    const cityAndStatus = await this.resolveCreateCityAndStatus(authContext, input)

    const existing = await this.prisma.whatsAppDepartmentMapping.findFirst({
      where: {
        clientId: authContext.clientId,
        departmentId: input.departmentId,
      },
    })

    if (existing !== null) {
      const departmentLabel =
        input.departmentLabel === undefined ? existing.departmentLabel : input.departmentLabel
      const cityChanged = existing.cityId !== cityAndStatus.cityId
      const statusChanged = existing.status !== cityAndStatus.status

      const updated = await this.prisma.whatsAppDepartmentMapping.update({
        where: { id: existing.id },
        data: {
          departmentLabel,
          cityId: cityAndStatus.cityId,
          status: cityAndStatus.status,
        },
      })

      if (cityChanged || statusChanged) {
        await this.syncSessionsCity(authContext.clientId, existing.departmentId, cityAndStatus.cityId)
      }

      return updated
    }

    const created = await this.prisma.whatsAppDepartmentMapping.create({
      data: {
        id: randomUUID(),
        clientId: authContext.clientId,
        departmentId: input.departmentId,
        departmentLabel: input.departmentLabel === undefined ? null : input.departmentLabel,
        cityId: cityAndStatus.cityId,
        status: cityAndStatus.status,
      },
    })

    if (cityAndStatus.status === WhatsAppDepartmentMappingStatus.MAPPED) {
      await this.syncSessionsCity(authContext.clientId, created.departmentId, cityAndStatus.cityId)
    }

    return created
  }

  async update(
    authContext: AuthContext,
    id: string,
    input: UpdateWhatsAppDepartmentMappingInput,
  ): Promise<WhatsAppDepartmentMappingSummary> {
    const existing = await this.get(authContext, id)
    const next = await this.resolvePatchState(authContext, existing, input)

    const cityChanged = existing.cityId !== next.cityId
    const statusChanged = existing.status !== next.status

    const updated = await this.prisma.whatsAppDepartmentMapping.update({
      where: { id: existing.id },
      data: {
        departmentLabel: next.departmentLabel,
        cityId: next.cityId,
        status: next.status,
      },
    })

    if (cityChanged || statusChanged) {
      await this.syncSessionsCity(authContext.clientId, existing.departmentId, next.cityId)
    }

    return updated
  }

  async syncSessionsCity(clientId: string, departmentId: string, cityId: string | null): Promise<void> {
    await this.prisma.messagingSession.updateMany({
      where: { clientId, externalDepartmentId: departmentId },
      data: { whatsappCityId: cityId },
    })
  }

  private async resolveCreateCityAndStatus(
    authContext: AuthContext,
    input: CreateWhatsAppDepartmentMappingInput,
  ): Promise<{
    cityId: string | null
    status: WhatsAppDepartmentMappingStatus
  }> {
    if (input.cityId === undefined || input.cityId === null) {
      return {
        cityId: null,
        status: WhatsAppDepartmentMappingStatus.PENDING,
      }
    }

    await this.requireCityForClient(authContext, input.cityId)

    return {
      cityId: input.cityId,
      status: WhatsAppDepartmentMappingStatus.MAPPED,
    }
  }

  private async resolvePatchState(
    authContext: AuthContext,
    existing: WhatsAppDepartmentMappingSummary,
    input: UpdateWhatsAppDepartmentMappingInput,
  ): Promise<{
    departmentLabel: string | null
    cityId: string | null
    status: WhatsAppDepartmentMappingStatus
  }> {
    if (
      input.cityId !== undefined &&
      input.cityId !== null &&
      input.status === WhatsAppDepartmentMappingStatus.PENDING
    ) {
      throw new BadRequestException('Cannot set cityId together with status PENDING')
    }

    if (input.cityId === null && input.status === WhatsAppDepartmentMappingStatus.MAPPED) {
      throw new BadRequestException('Cannot clear cityId together with status MAPPED')
    }

    let departmentLabel = existing.departmentLabel
    let cityId = existing.cityId
    let status = existing.status

    if (input.departmentLabel !== undefined) {
      departmentLabel = input.departmentLabel
    }

    if (input.cityId !== undefined) {
      if (input.cityId === null) {
        cityId = null
        status = WhatsAppDepartmentMappingStatus.PENDING
      } else {
        await this.requireCityForClient(authContext, input.cityId)
        cityId = input.cityId
        status = WhatsAppDepartmentMappingStatus.MAPPED
      }
    }

    if (input.status !== undefined) {
      if (input.status === WhatsAppDepartmentMappingStatus.PENDING) {
        cityId = null
        status = WhatsAppDepartmentMappingStatus.PENDING
      } else {
        status = WhatsAppDepartmentMappingStatus.MAPPED
      }
    }

    if (status === WhatsAppDepartmentMappingStatus.MAPPED && cityId === null) {
      throw new BadRequestException('MAPPED status requires a cityId')
    }

    if (status === WhatsAppDepartmentMappingStatus.PENDING) {
      cityId = null
    }

    return { departmentLabel, cityId, status }
  }

  private async requireCityForClient(authContext: AuthContext, cityId: string): Promise<void> {
    const city = await this.prisma.whatsAppCity.findFirst({
      where: { id: cityId, clientId: authContext.clientId },
    })

    if (city === null) {
      throw new NotFoundException('WhatsApp city not found')
    }
  }
}
