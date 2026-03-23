import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../../config/env'

function buildAdapter(databaseUrl: string): PrismaPg {
  const parsedUrl = new URL(databaseUrl)
  const schema = parsedUrl.searchParams.get('schema') ?? 'public'

  parsedUrl.searchParams.delete('schema')

  return new PrismaPg(
    {
      connectionString: parsedUrl.toString(),
    },
    {
      schema,
    },
  )
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const env = loadEnv(process.env)

    super({
      adapter: buildAdapter(env.DATABASE_URL),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
