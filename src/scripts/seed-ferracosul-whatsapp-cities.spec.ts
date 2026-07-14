import {
  FERRACOSUL_CLIENT_ID,
  FERRACOSUL_WHATSAPP_CITIES,
  FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS,
  seedFerracosulWhatsappCities,
} from './seed-ferracosul-whatsapp-cities'

describe('seedFerracosulWhatsappCities data', () => {
  it('defines 3 cities and 17 department mappings', () => {
    expect(FERRACOSUL_CLIENT_ID).toBe('ferracosul')
    expect(FERRACOSUL_WHATSAPP_CITIES).toHaveLength(3)
    expect(FERRACOSUL_WHATSAPP_CITIES.map((city) => city.name)).toEqual([
      'Pelotas',
      'Rio Grande',
      'Santa Maria',
    ])
    expect(FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS).toHaveLength(17)

    const pelotas = FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS.filter((m) => m.cityName === 'Pelotas')
    const rioGrande = FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS.filter((m) => m.cityName === 'Rio Grande')
    const santaMaria = FERRACOSUL_WHATSAPP_DEPARTMENT_MAPPINGS.filter(
      (m) => m.cityName === 'Santa Maria',
    )

    expect(pelotas).toHaveLength(7)
    expect(rioGrande).toHaveLength(5)
    expect(santaMaria).toHaveLength(5)

    expect(pelotas.map((m) => m.departmentId)).toEqual([
      'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
      '25208c87-c4c0-4d51-a77e-22a0d1a2bb8f',
      'b1b55081-4158-41c1-bc9f-f76f3e0ca8a4',
      '67bc4548-4782-42c6-9b36-013726936cfd',
      'd023765e-1c5d-47a9-bcf3-3b3ac1bef952',
      'f8b23ba4-d063-4815-bb10-ec46014f3660',
      '52d50f0f-f43f-47d0-bb4a-e2385138e2c2',
    ])
    expect(rioGrande.map((m) => m.departmentId)).toEqual([
      'fd7c55e0-2de0-46d1-97e7-6c66ad322d55',
      'b3a7857c-0398-4e1b-93bc-777a5edd043c',
      'b761de62-753b-4dba-91b5-74541395135f',
      '42eed417-e10e-4b48-9b2c-6f77468e3ffd',
      '58f26e1b-37a3-4e61-84f0-d96b43c34274',
    ])
    expect(santaMaria.map((m) => m.departmentId)).toEqual([
      '6c0835de-593b-4df6-98fc-9838b2c35ca7',
      '5c35e6bf-77f8-4eae-912e-31d1d9261be4',
      '032fa04e-6f70-4d2f-ab40-6543683ee543',
      'd4f4b88a-2342-4da0-8793-7ebfbd94b2f6',
      'da759587-53ac-4c71-969c-08a2236f52f4',
    ])
  })
})

describe('seedFerracosulWhatsappCities', () => {
  it('upserts cities, then mappings, then backfills external_department_id, then updates city by mapping', async () => {
    const callOrder: string[] = []

    const cityIds = {
      Pelotas: 'city-pelotas',
      'Rio Grande': 'city-rio-grande',
      'Santa Maria': 'city-santa-maria',
    }

    const prisma = {
      whatsAppCity: {
        upsert: jest.fn().mockImplementation(async (args: { where: { clientId_name: { name: string } } }) => {
          callOrder.push(`city:${args.where.clientId_name.name}`)
          const name = args.where.clientId_name.name as keyof typeof cityIds
          return { id: cityIds[name], name }
        }),
      },
      whatsAppDepartmentMapping: {
        upsert: jest.fn().mockImplementation(async (args: {
          where: { clientId_departmentId: { departmentId: string } }
          create: { cityId: string }
        }) => {
          callOrder.push(`mapping:${args.where.clientId_departmentId.departmentId}`)
          return {
            departmentId: args.where.clientId_departmentId.departmentId,
            cityId: args.create.cityId,
            status: 'MAPPED',
          }
        }),
      },
      $executeRawUnsafe: jest.fn().mockImplementation(async () => {
        callOrder.push('backfill')
        return 10
      }),
      messagingSession: {
        updateMany: jest.fn().mockImplementation(async (args: {
          where: { externalDepartmentId: string }
        }) => {
          callOrder.push(`session:${args.where.externalDepartmentId}`)
          return { count: 1 }
        }),
      },
    }

    const result = await seedFerracosulWhatsappCities(prisma)

    expect(result.clientId).toBe('ferracosul')
    expect(result.citiesUpserted).toBe(3)
    expect(result.mappingsUpserted).toBe(17)
    expect(result.externalDepartmentBackfilled).toBe(10)
    expect(result.sessionsUpdatedByMapping).toBe(17)

    expect(prisma.whatsAppCity.upsert).toHaveBeenCalledTimes(3)
    expect(prisma.whatsAppDepartmentMapping.upsert).toHaveBeenCalledTimes(17)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1)
    expect(prisma.messagingSession.updateMany).toHaveBeenCalledTimes(17)

    const firstCityCall = callOrder.findIndex((step) => step.startsWith('city:'))
    const firstMappingCall = callOrder.findIndex((step) => step.startsWith('mapping:'))
    const backfillCall = callOrder.indexOf('backfill')
    const firstSessionCall = callOrder.findIndex((step) => step.startsWith('session:'))

    expect(firstCityCall).toBeGreaterThanOrEqual(0)
    expect(firstMappingCall).toBeGreaterThan(firstCityCall)
    expect(backfillCall).toBeGreaterThan(firstMappingCall)
    expect(firstSessionCall).toBeGreaterThan(backfillCall)

    expect(callOrder.filter((step) => step.startsWith('city:'))).toHaveLength(3)
    expect(callOrder.filter((step) => step.startsWith('mapping:'))).toHaveLength(17)
    expect(callOrder.filter((step) => step.startsWith('session:'))).toHaveLength(17)

    const [sql, clientId] = prisma.$executeRawUnsafe.mock.calls[0] as [string, string]
    expect(clientId).toBe('ferracosul')
    expect(sql).toContain('external_department_id')
    expect(sql).toContain("raw_json->>'departmentId'")
    expect(sql).toContain("provider = 'FLW'")

    expect(prisma.whatsAppDepartmentMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId_departmentId: {
            clientId: 'ferracosul',
            departmentId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
          },
        },
        create: expect.objectContaining({
          clientId: 'ferracosul',
          departmentId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
          departmentLabel: 'Balcão Pelotas',
          cityId: 'city-pelotas',
          status: 'MAPPED',
        }),
        update: expect.objectContaining({
          departmentLabel: 'Balcão Pelotas',
          cityId: 'city-pelotas',
          status: 'MAPPED',
        }),
      }),
    )

    expect(prisma.messagingSession.updateMany).toHaveBeenCalledWith({
      where: {
        clientId: 'ferracosul',
        externalDepartmentId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
      },
      data: { whatsappCityId: 'city-pelotas' },
    })
  })
})
