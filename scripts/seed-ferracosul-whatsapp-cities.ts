import 'dotenv/config'
import { PrismaService } from '../src/infra/prisma/prisma.service'
import { seedFerracosulWhatsappCities } from '../src/scripts/seed-ferracosul-whatsapp-cities'

async function main() {
  const prisma = new PrismaService()

  try {
    await prisma.$connect()

    const result = await seedFerracosulWhatsappCities(prisma)

    console.log(
      `Seed whatsapp cities concluido para ${result.clientId}: ` +
        `${result.citiesUpserted} cidades, ${result.mappingsUpserted} mappings, ` +
        `${result.externalDepartmentBackfilled} sessions com external_department_id backfill, ` +
        `${result.sessionsUpdatedByMapping} mappings aplicados em sessions.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
