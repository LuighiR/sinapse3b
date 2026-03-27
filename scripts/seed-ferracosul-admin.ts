import 'dotenv/config'
import { PrismaService } from '../src/infra/prisma/prisma.service'
import { seedFerracosulAdmin } from '../src/scripts/seed-ferracosul-admin'

async function main() {
  const prisma = new PrismaService()

  try {
    await prisma.$connect()

    const result = await seedFerracosulAdmin(prisma, {
      email: 'admin@sinapse.com',
      password: 'admin@123',
      name: 'Administrador Ferracosul',
    })

    console.log(`Seed concluido para ${result.email} no tenant ${result.tenantId}.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
