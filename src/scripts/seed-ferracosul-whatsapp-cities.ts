import { randomUUID } from 'node:crypto'
import { WhatsAppDepartmentMappingStatus } from '@prisma/client'

export const FERRACOSUL_CLIENT_ID = 'ferracosul'

export type FerracosulWhatsappCitySeed = {
  name: string
}

export type FerracosulWhatsappDepartmentMappingSeed = {
  cityName: string
  departmentId: string
  departmentLabel: string
}

export const FERRACOSUL_WHATSAPP_CITIES: FerracosulWhatsappCitySeed[] = [
  { name: 'Pelotas' },
  { name: 'Rio Grande' },
  { name: 'Santa Maria' },
]

export const FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS: FerracosulWhatsappDepartmentMappingSeed[] = [
  // Pelotas
  {
    cityName: 'Pelotas',
    departmentId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
    departmentLabel: 'Balcão Pelotas',
  },
  {
    cityName: 'Pelotas',
    departmentId: '25208c87-c4c0-4d51-a77e-22a0d1a2bb8f',
    departmentLabel: 'Cadastro/Cobrança',
  },
  {
    cityName: 'Pelotas',
    departmentId: 'b1b55081-4158-41c1-bc9f-f76f3e0ca8a4',
    departmentLabel: 'Inicio - Pelotas',
  },
  {
    cityName: 'Pelotas',
    departmentId: '67bc4548-4782-42c6-9b36-013726936cfd',
    departmentLabel: 'Pelotas',
  },
  {
    cityName: 'Pelotas',
    departmentId: 'd023765e-1c5d-47a9-bcf3-3b3ac1bef952',
    departmentLabel: 'Projetos Corte e Dobra de Vergalhão',
  },
  {
    cityName: 'Pelotas',
    departmentId: 'f8b23ba4-d063-4815-bb10-ec46014f3660',
    departmentLabel: 'Vendas Geral - Pelotas',
  },
  {
    cityName: 'Pelotas',
    departmentId: '52d50f0f-f43f-47d0-bb4a-e2385138e2c2',
    departmentLabel: 'Vendas Vidros/Alumínio - Pelotas',
  },
  // Rio Grande
  {
    cityName: 'Rio Grande',
    departmentId: 'fd7c55e0-2de0-46d1-97e7-6c66ad322d55',
    departmentLabel: 'Balcão Rio Grande',
  },
  {
    cityName: 'Rio Grande',
    departmentId: 'b3a7857c-0398-4e1b-93bc-777a5edd043c',
    departmentLabel: 'Inicio Rio Grande',
  },
  {
    cityName: 'Rio Grande',
    departmentId: 'b761de62-753b-4dba-91b5-74541395135f',
    departmentLabel: 'Rio Grande',
  },
  {
    cityName: 'Rio Grande',
    departmentId: '42eed417-e10e-4b48-9b2c-6f77468e3ffd',
    departmentLabel: 'Vendas Geral - Rio Grande',
  },
  {
    cityName: 'Rio Grande',
    departmentId: '58f26e1b-37a3-4e61-84f0-d96b43c34274',
    departmentLabel: 'Vendas Vidros/Alumínio - Rio Grande',
  },
  // Santa Maria
  {
    cityName: 'Santa Maria',
    departmentId: '6c0835de-593b-4df6-98fc-9838b2c35ca7',
    departmentLabel: 'Balcão Santa Maria',
  },
  {
    cityName: 'Santa Maria',
    departmentId: '5c35e6bf-77f8-4eae-912e-31d1d9261be4',
    departmentLabel: 'Inicio Santa Maria',
  },
  {
    cityName: 'Santa Maria',
    departmentId: '032fa04e-6f70-4d2f-ab40-6543683ee543',
    departmentLabel: 'Santa Maria',
  },
  {
    cityName: 'Santa Maria',
    departmentId: 'd4f4b88a-2342-4da0-8793-7ebfbd94b2f6',
    departmentLabel: 'Vendas Geral - Santa Maria',
  },
  {
    cityName: 'Santa Maria',
    departmentId: 'da759587-53ac-4c71-969c-08a2236f52f4',
    departmentLabel: 'Vendas Vidros/Alumínio - Santa Maria',
  },
]

export type SeedFerracosulWhatsappCitiesResult = {
  clientId: string
  citiesUpserted: number
  mappingsUpserted: number
  externalDepartmentBackfilled: number
  sessionsUpdatedByMapping: number
}

type SeedFerracosulWhatsappCitiesRepositories = {
  whatsAppCity: {
    upsert(args: unknown): Promise<{ id: string; name: string }>
  }
  whatsAppDepartmentMapping: {
    upsert(args: unknown): Promise<{
      departmentId: string
      cityId: string | null
      status: string
    }>
  }
  messagingSession: {
    updateMany(args: unknown): Promise<{ count: number }>
  }
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>
}

const EXTERNAL_DEPARTMENT_BACKFILL_SQL = `
UPDATE core.messaging_sessions
SET external_department_id = (raw_json->>'departmentId')::uuid
WHERE client_id = $1
  AND provider = 'FLW'
  AND external_department_id IS NULL
  AND raw_json ? 'departmentId'
  AND raw_json->>'departmentId' ~ '^[0-9a-f-]{36}$'
`

export async function seedFerracosulWhatsappCities(
  repositories: SeedFerracosulWhatsappCitiesRepositories,
): Promise<SeedFerracosulWhatsappCitiesResult> {
  const cityIdByName = new Map<string, string>()

  for (const city of FERRACOSUL_WHATSAPP_CITIES) {
    const upserted = await repositories.whatsAppCity.upsert({
      where: {
        clientId_name: {
          clientId: FERRACOSUL_CLIENT_ID,
          name: city.name,
        },
      },
      create: {
        id: randomUUID(),
        clientId: FERRACOSUL_CLIENT_ID,
        name: city.name,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })

    cityIdByName.set(city.name, upserted.id)
  }

  const mappedDepartments: Array<{ departmentId: string; cityId: string }> = []

  for (const mapping of FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS) {
    const cityId = cityIdByName.get(mapping.cityName)

    if (cityId === undefined) {
      throw new Error(`Missing city id for ${mapping.cityName}`)
    }

    await repositories.whatsAppDepartmentMapping.upsert({
      where: {
        clientId_departmentId: {
          clientId: FERRACOSUL_CLIENT_ID,
          departmentId: mapping.departmentId,
        },
      },
      create: {
        id: randomUUID(),
        clientId: FERRACOSUL_CLIENT_ID,
        departmentId: mapping.departmentId,
        departmentLabel: mapping.departmentLabel,
        cityId,
        status: WhatsAppDepartmentMappingStatus.MAPPED,
      },
      update: {
        departmentLabel: mapping.departmentLabel,
        cityId,
        status: WhatsAppDepartmentMappingStatus.MAPPED,
      },
    })

    mappedDepartments.push({ departmentId: mapping.departmentId, cityId })
  }

  const externalDepartmentBackfilled = await repositories.$executeRawUnsafe(
    EXTERNAL_DEPARTMENT_BACKFILL_SQL,
    FERRACOSUL_CLIENT_ID,
  )

  for (const mapping of mappedDepartments) {
    await repositories.messagingSession.updateMany({
      where: {
        clientId: FERRACOSUL_CLIENT_ID,
        externalDepartmentId: mapping.departmentId,
      },
      data: {
        whatsappCityId: mapping.cityId,
      },
    })
  }

  return {
    clientId: FERRACOSUL_CLIENT_ID,
    citiesUpserted: FERRACOSUL_WHATSAPP_CITIES.length,
    mappingsUpserted: FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS.length,
    externalDepartmentBackfilled,
    sessionsUpdatedByMapping: mappedDepartments.length,
  }
}
