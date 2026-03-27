import { DynamicModule, Global, INestApplication, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../src/app.module'
import { loadEnv } from '../../src/config/env'
import { configureApp } from '../../src/configure-app'
import { PrismaService } from '../../src/infra/prisma/prisma.service'
import { AUTH_TEST_FIXTURES } from '../../src/modules/auth/application/user-membership.service'
import { TestFixtures, createTestFixtures, ensureTestEnv } from './fakes'

export const TEST_FIXTURES = AUTH_TEST_FIXTURES
export const TEST_USERS_REPOSITORY = Symbol('TEST_USERS_REPOSITORY')
export const TEST_TENANTS_REPOSITORY = Symbol('TEST_TENANTS_REPOSITORY')
export const TEST_MEMBERSHIPS_REPOSITORY = Symbol('TEST_MEMBERSHIPS_REPOSITORY')
export const TEST_CLIENTS_REPOSITORY = Symbol('TEST_CLIENTS_REPOSITORY')
export const TEST_BRANCHES_REPOSITORY = Symbol('TEST_BRANCHES_REPOSITORY')
export const TEST_EMPLOYEES_REPOSITORY = Symbol('TEST_EMPLOYEES_REPOSITORY')

export type TestRepositoryOverrides = Partial<Record<
  | typeof TEST_USERS_REPOSITORY
  | typeof TEST_TENANTS_REPOSITORY
  | typeof TEST_MEMBERSHIPS_REPOSITORY
  | typeof TEST_CLIENTS_REPOSITORY
  | typeof TEST_BRANCHES_REPOSITORY
  | typeof TEST_EMPLOYEES_REPOSITORY,
  unknown
>>

export type BuildTestAppOptions = TestFixtures & {
  repositories?: TestRepositoryOverrides
}

@Global()
@Module({})
class TestAppSupportModule {
  static register(options: BuildTestAppOptions = {}): DynamicModule {
    const fixtures = createTestFixtures(options)

    return {
      module: TestAppSupportModule,
      providers: [
        { provide: TEST_FIXTURES, useValue: fixtures },
        { provide: TEST_USERS_REPOSITORY, useValue: options.repositories?.[TEST_USERS_REPOSITORY] ?? null },
        { provide: TEST_TENANTS_REPOSITORY, useValue: options.repositories?.[TEST_TENANTS_REPOSITORY] ?? null },
        { provide: TEST_MEMBERSHIPS_REPOSITORY, useValue: options.repositories?.[TEST_MEMBERSHIPS_REPOSITORY] ?? null },
        { provide: TEST_CLIENTS_REPOSITORY, useValue: options.repositories?.[TEST_CLIENTS_REPOSITORY] ?? null },
        { provide: TEST_BRANCHES_REPOSITORY, useValue: options.repositories?.[TEST_BRANCHES_REPOSITORY] ?? null },
        { provide: TEST_EMPLOYEES_REPOSITORY, useValue: options.repositories?.[TEST_EMPLOYEES_REPOSITORY] ?? null },
      ],
      exports: [
        TEST_FIXTURES,
        TEST_USERS_REPOSITORY,
        TEST_TENANTS_REPOSITORY,
        TEST_MEMBERSHIPS_REPOSITORY,
        TEST_CLIENTS_REPOSITORY,
        TEST_BRANCHES_REPOSITORY,
        TEST_EMPLOYEES_REPOSITORY,
      ],
    }
  }
}

export async function buildTestApp(options: BuildTestAppOptions = {}): Promise<INestApplication> {
  ensureTestEnv()

  const prismaStub = {
    user: {
      findUnique: async () => {
        throw new Error('Prisma fallback should not run when auth fixtures are provided')
      },
    },
    membership: {
      findFirst: async () => {
        throw new Error('Prisma fallback should not run when auth fixtures are provided')
      },
      findMany: async () => {
        throw new Error('Prisma fallback should not run when auth fixtures are provided')
      },
    },
    tenant: {
      findUnique: async () => {
        throw new Error('Prisma fallback should not run when auth fixtures are provided')
      },
    },
    sinapseClient: {
      findUnique: async () => {
        throw new Error('Prisma fallback should not run when auth fixtures are provided')
      },
    },
  }

  const moduleBuilder = Test.createTestingModule({
    imports: [TestAppSupportModule.register(options), AppModule],
  }).overrideProvider(PrismaService)
    .useValue(prismaStub)

  const moduleRef = await moduleBuilder.compile()

  const app = moduleRef.createNestApplication()
  configureApp(app, loadEnv(process.env))
  await app.init()
  return app
}
