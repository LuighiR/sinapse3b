# Auth And Company Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the Sinapse KPI backend: NestJS bootstrap, Prisma access to `core`, JWT validation for Next.js-issued tokens, tenant scoping with `X-Tenant-Id`, and read APIs for user context, companies, branches, and employees.

**Architecture:** Start with a single NestJS API application at the repository root. Use Prisma only for the `core` schema in this slice, keep tenant resolution request-scoped, and enforce access through JWT + membership + tenant-to-client mapping before any company data is returned.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Jest, Supertest, Zod, jose

---

## Planned File Structure

### Root and Tooling

- Create: `package.json`
- Create: `jest.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`

### App Bootstrap

- Create: `src/main.ts`
- Create: `src/app.module.ts`
- Create: `src/modules/health/health.module.ts`
- Create: `src/modules/health/health.controller.ts`

### Config and Shared Infrastructure

- Create: `src/config/env.ts`
- Create: `src/config/env.spec.ts`
- Create: `src/common/http/api-error.filter.ts`
- Create: `src/common/http/http-exception.body.ts`
- Create: `src/infra/prisma/prisma.module.ts`
- Create: `src/infra/prisma/prisma.service.ts`

### Prisma and Database

- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/20260320_add_branch_id_to_core_employees.sql`

### Auth and Request Context

- Create: `src/modules/auth/auth.module.ts`
- Create: `src/modules/auth/domain/auth-context.ts`
- Create: `src/modules/auth/application/jwt-auth.service.ts`
- Create: `src/modules/auth/application/request-context.service.ts`
- Create: `src/modules/auth/application/user-membership.service.ts`
- Create: `src/modules/auth/presentation/auth-context.controller.ts`
- Create: `src/modules/auth/presentation/guards/jwt-auth.guard.ts`
- Create: `src/modules/auth/presentation/guards/tenant-scope.guard.ts`
- Create: `src/modules/auth/presentation/decorators/request-context.decorator.ts`

### User and Company APIs

- Create: `src/modules/me/me.module.ts`
- Create: `src/modules/me/presentation/me.controller.ts`
- Create: `src/modules/companies/companies.module.ts`
- Create: `src/modules/companies/application/companies.service.ts`
- Create: `src/modules/companies/application/branches.service.ts`
- Create: `src/modules/companies/application/employees.service.ts`
- Create: `src/modules/companies/presentation/companies.controller.ts`
- Create: `src/modules/companies/presentation/query/employees.query.ts`

### Tests

- Create: `test/jest-e2e.json`
- Create: `test/app.e2e-spec.ts`
- Create: `test/auth-context.e2e-spec.ts`
- Create: `test/me.e2e-spec.ts`
- Create: `test/companies.e2e-spec.ts`
- Create: `test/helpers/build-test-app.ts`
- Create: `test/helpers/fakes.ts`

## Task 1: Bootstrap The NestJS API Workspace

**Files:**
- Create: `package.json`
- Create: `jest.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `.gitignore`
- Create: `src/main.ts`
- Create: `src/app.module.ts`
- Create: `src/modules/health/health.module.ts`
- Create: `src/modules/health/health.controller.ts`
- Create: `test/jest-e2e.json`
- Create: `test/app.e2e-spec.ts`
- Create: `test/helpers/build-test-app.ts`
- Create: `test/helpers/fakes.ts`

- [ ] **Step 1: Write the failing bootstrap smoke test**

```ts
import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'

describe('bootstrap', () => {
  it('GET /health returns ok', async () => {
    const app = await buildTestApp()

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run the bootstrap test to verify it fails**

Run: `npm test -- --runInBand test/app.e2e-spec.ts`
Expected: FAIL because the NestJS app and test helper do not exist yet.

- [ ] **Step 3: Create the minimal NestJS application bootstrap**

```ts
// src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common'

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok' }
  }
}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

```ts
// test/helpers/build-test-app.ts
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../../src/app.module'

export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication()
  await app.init()
  return app
}
```

```ts
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
}
```

```ts
// test/helpers/fakes.ts
import { SignJWT } from 'jose'

const TEST_SECRET = new TextEncoder().encode('test-secret-with-at-least-32-chars')

export function buildJwt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuer('sinapse-next')
    .setAudience('sinapse-kpi-api')
    .sign(TEST_SECRET)
}
```

- [ ] **Step 4: Run the bootstrap test to verify it passes**

Run: `npm test -- --runInBand test/app.e2e-spec.ts`
Expected: PASS with one passing smoke test.

- [ ] **Step 5: Commit**

```bash
git add package.json jest.config.ts tsconfig.json tsconfig.build.json nest-cli.json .gitignore src/main.ts src/app.module.ts src/modules/health test/jest-e2e.json test/app.e2e-spec.ts test/helpers/build-test-app.ts test/helpers/fakes.ts
git commit -m "feat: bootstrap nest api workspace"
```

## Task 2: Add Environment Validation And Prisma Core Access

**Files:**
- Create: `.env.example`
- Create: `README.md`
- Create: `src/config/env.ts`
- Create: `src/config/env.spec.ts`
- Create: `src/infra/prisma/prisma.module.ts`
- Create: `src/infra/prisma/prisma.service.ts`
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing environment validation test**

```ts
import { loadEnv } from './env'

describe('loadEnv', () => {
  it('requires the core database url and jwt settings', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: '',
        AUTH_JWT_SECRET: '',
        AUTH_JWT_ISSUER: '',
        AUTH_JWT_AUDIENCE: '',
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the env test to verify it fails**

Run: `npm test -- --runInBand src/config/env.spec.ts`
Expected: FAIL because the env loader does not exist yet.

- [ ] **Step 3: Implement env parsing and Prisma bootstrap**

```ts
// src/config/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_ISSUER: z.string().min(1),
  AUTH_JWT_AUDIENCE: z.string().min(1),
})

export function loadEnv(input: Record<string, string | undefined>) {
  return EnvSchema.parse(input)
}
```

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

Use a `DATABASE_URL` that points Prisma to the `core` schema for this slice.

- [ ] **Step 4: Run the env test and Prisma validation**

Run: `npm test -- --runInBand src/config/env.spec.ts`
Expected: PASS

Run: `npx prisma validate --schema prisma/schema.prisma`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md src/config/env.ts src/config/env.spec.ts src/infra/prisma prisma/schema.prisma
git commit -m "feat: add env validation and prisma core access"
```

## Task 3: Model Core Tables And Add `employees.branch_id`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260320_add_branch_id_to_core_employees.sql`
- Modify: `test/helpers/build-test-app.ts`
- Modify: `test/helpers/fakes.ts`
- Create: `test/companies.e2e-spec.ts`

- [ ] **Step 1: Write the failing employee scoping test**

```ts
it('returns employees only for branches inside the active client scope', async () => {
  const app = await buildTestApp({
    memberships: [{ userId: 'u1', tenantId: 't1' }],
    tenants: [{ id: 't1', backendClientId: 'c1' }],
    branches: [{ id: 10, clientId: 'c1' }],
    employees: [{ id: 20, branchId: 10, name: 'Maria' }],
  })

  await request(app.getHttpServer())
    .get('/companies/current/employees')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(200)
    .expect(expect.arrayContaining([expect.objectContaining({ id: 20 })]))
})
```

- [ ] **Step 2: Run the employee scoping test to verify it fails**

Run: `npm test -- --runInBand test/companies.e2e-spec.ts`
Expected: FAIL because employees are not modeled and the endpoint does not exist yet.

- [ ] **Step 3: Add Prisma models and SQL migration**

Create the migration with the minimum safe SQL:

```sql
ALTER TABLE core.employees
ADD COLUMN branch_id integer;

ALTER TABLE core.employees
ADD CONSTRAINT employees_branch_id_fkey
FOREIGN KEY (branch_id) REFERENCES core.branches(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX employees_branch_id_idx ON core.employees(branch_id);
```

Map these Prisma models at minimum:

- `User`
- `Tenant`
- `Membership`
- `SinapseClient`
- `Branch`
- `Employee`

Use `@@map`/`@map` to align Prisma names with `snake_case` columns in `core`.

Extend `test/helpers/build-test-app.ts` so later e2e tests can inject repository doubles or fixture arrays for users, tenants, memberships, clients, branches, and employees without requiring a real database.

- [ ] **Step 4: Validate Prisma schema and migration SQL**

Run: `npx prisma validate --schema prisma/schema.prisma`
Expected: PASS

Run: `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260320_add_branch_id_to_core_employees.sql`
Expected: command completes successfully against the target database

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260320_add_branch_id_to_core_employees.sql test/companies.e2e-spec.ts
git commit -m "feat: model core org tables and add employee branch relation"
```

## Task 4: Implement JWT Validation And Tenant Request Context

**Files:**
- Create: `src/modules/auth/auth.module.ts`
- Create: `src/modules/auth/domain/auth-context.ts`
- Create: `src/modules/auth/application/jwt-auth.service.ts`
- Create: `src/modules/auth/application/request-context.service.ts`
- Create: `src/modules/auth/application/user-membership.service.ts`
- Create: `src/modules/auth/presentation/auth-context.controller.ts`
- Create: `src/modules/auth/presentation/guards/jwt-auth.guard.ts`
- Create: `src/modules/auth/presentation/guards/tenant-scope.guard.ts`
- Create: `src/modules/auth/presentation/decorators/request-context.decorator.ts`
- Create: `test/auth-context.e2e-spec.ts`
- Modify: `test/helpers/fakes.ts`

- [ ] **Step 1: Write the failing auth context tests**

```ts
it('rejects requests without a bearer token', async () => {
  const app = await buildTestApp()

  await request(app.getHttpServer())
    .get('/auth/context')
    .expect(401)
})

it('rejects requests without X-Tenant-Id', async () => {
  const app = await buildTestApp()

  await request(app.getHttpServer())
    .get('/auth/context')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .expect(400)
})

it('rejects requests when the resolved backend client is inactive', async () => {
  const app = await buildTestApp({
    users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
    tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
    memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
    clients: [{ id: 'c1', name: 'Ferraco', isActive: false }],
  })

  await request(app.getHttpServer())
    .get('/auth/context')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(403)
})

it('rejects requests when the membership is inactive', async () => {
  const app = await buildTestApp({
    users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
    tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
    memberships: [{ userId: 'u1', tenantId: 't1', isActive: false, role: 'ADMIN' }],
    clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
  })

  await request(app.getHttpServer())
    .get('/auth/context')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(403)
})

it('rejects requests when the tenant is inactive', async () => {
  const app = await buildTestApp({
    users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
    tenants: [{ id: 't1', backendClientId: 'c1', isActive: false }],
    memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
    clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
  })

  await request(app.getHttpServer())
    .get('/auth/context')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(403)
})
```

- [ ] **Step 2: Run the auth context tests to verify they fail**

Run: `npm test -- --runInBand test/auth-context.e2e-spec.ts`
Expected: FAIL because auth guards and context resolution do not exist yet.

- [ ] **Step 3: Implement JWT auth and tenant scoping**

Use `jose` with `HS256` in the first iteration:

```ts
// jwt-auth.service.ts
const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET)
const { payload } = await jwtVerify(token, secret, {
  issuer: env.AUTH_JWT_ISSUER,
  audience: env.AUTH_JWT_AUDIENCE,
})
```

Resolve request context with:

- `userId` from JWT `sub`
- `tenantId` from `X-Tenant-Id`
- active membership lookup in `core.memberships`
- active tenant lookup in `core.tenants`
- active backend client lookup through `tenant.backend_client_id` in `core.sinapse_clients`

Store the resolved context on the request so downstream controllers and services never re-parse headers.

- [ ] **Step 4: Run the auth context tests to verify they pass**

Run: `npm test -- --runInBand test/auth-context.e2e-spec.ts`
Expected: PASS with 401 for missing JWT, 400 for missing tenant header, and 403 for inactive membership, inactive tenant, or inactive backend client.

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth test/auth-context.e2e-spec.ts test/helpers/fakes.ts
git commit -m "feat: add jwt auth and tenant request context"
```

## Task 5: Expose `GET /auth/context`, `GET /me`, And `GET /me/tenants`

**Files:**
- Modify: `src/modules/auth/presentation/auth-context.controller.ts`
- Create: `src/modules/me/me.module.ts`
- Create: `src/modules/me/presentation/me.controller.ts`
- Modify: `src/app.module.ts`
- Modify: `test/helpers/build-test-app.ts`
- Create: `test/me.e2e-spec.ts`

- [ ] **Step 1: Write the failing user context tests**

```ts
it('returns the resolved auth context', async () => {
  const app = await buildTestApp({
    users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
    tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
    memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
  })

  const response = await request(app.getHttpServer())
    .get('/auth/context')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(200)

  expect(response.body).toMatchObject({
    user: { id: 'u1' },
    tenant: { id: 't1' },
    client: { id: 'c1' },
  })
})
```

- [ ] **Step 2: Run the user context tests to verify they fail**

Run: `npm test -- --runInBand test/me.e2e-spec.ts`
Expected: FAIL because the controllers do not exist yet.

- [ ] **Step 3: Implement the controllers and DTO shape**

Expose:

- `GET /auth/context`
- `GET /me`
- `GET /me/tenants`

Minimal response contracts:

```ts
{
  user: { id: string; email: string; name: string | null }
  tenant: { id: string; name: string; slug: string }
  client: { id: string; name: string }
  membership: { role: string }
}
```

```ts
type MeTenantItem = {
  id: string
  name: string
  slug: string
  role: string
  backendClientId: string | null
}
```

- [ ] **Step 4: Run the user context tests to verify they pass**

Run: `npm test -- --runInBand test/me.e2e-spec.ts`
Expected: PASS with stable JSON contracts for context and tenant listing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/presentation/auth-context.controller.ts src/modules/me src/app.module.ts test/me.e2e-spec.ts
git commit -m "feat: expose auth context and me endpoints"
```

## Task 6: Expose Company, Branch, And Employee APIs

**Files:**
- Create: `src/modules/companies/companies.module.ts`
- Create: `src/modules/companies/application/companies.service.ts`
- Create: `src/modules/companies/application/branches.service.ts`
- Create: `src/modules/companies/application/employees.service.ts`
- Create: `src/modules/companies/presentation/companies.controller.ts`
- Create: `src/modules/companies/presentation/query/employees.query.ts`
- Modify: `src/app.module.ts`
- Modify: `test/helpers/build-test-app.ts`
- Modify: `test/companies.e2e-spec.ts`

- [ ] **Step 1: Write the failing company endpoint tests**

```ts
it('returns the current company from the active tenant scope', async () => {
  const app = await buildTestApp({
    tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
    clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
  })

  await request(app.getHttpServer())
    .get('/companies/current')
    .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
    .set('X-Tenant-Id', 't1')
    .expect(200)
    .expect(expect.objectContaining({ id: 'c1', name: 'Ferraco' }))
})
```

- [ ] **Step 2: Run the company endpoint tests to verify they fail**

Run: `npm test -- --runInBand test/companies.e2e-spec.ts`
Expected: FAIL because the company services and controller do not exist yet.

- [ ] **Step 3: Implement company, branch, and employee reads**

Expose:

- `GET /companies/current`
- `GET /companies/current/branches`
- `GET /companies/current/employees`

Support these employee query parameters in the first version:

- `branchId?: number`
- `search?: string`

Mandatory rules:

- always scope by resolved `clientId`
- when `branchId` is provided, ensure the branch belongs to the active client
- reject cross-tenant access with `403`

- [ ] **Step 4: Run the company endpoint tests to verify they pass**

Run: `npm test -- --runInBand test/companies.e2e-spec.ts`
Expected: PASS with client-scoped company, branch, and employee responses.

- [ ] **Step 5: Commit**

```bash
git add src/modules/companies src/app.module.ts test/companies.e2e-spec.ts
git commit -m "feat: add company branch and employee endpoints"
```

## Task 7: Verify The Slice End-To-End

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write the final verification checklist into the README**

Document:

- required environment variables
- how Next.js should sign JWTs for local development
- required `X-Tenant-Id` header
- commands to run tests and Prisma validation

- [ ] **Step 2: Run the full automated verification**

Run: `npm test -- --runInBand`
Expected: PASS

Run: `npx prisma validate --schema prisma/schema.prisma`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Smoke-test the key endpoints locally**

Run:

```bash
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/auth/context
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/me
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/me/tenants
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/companies/current
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/companies/current/branches
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/companies/current/employees
```

Expected: 200 responses for valid scope, 401/403/400 for invalid auth or invalid tenant scope.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: document auth and company foundation setup"
```

## Notes For Execution

- Use `HS256` with a shared `AUTH_JWT_SECRET` between Next.js and this backend for the first implementation.
- Keep Prisma scoped to `core` for now; do not model `raws` or `kpi` in this slice.
- Do not read from `public`.
- Do not add KPI endpoints in this plan.
- Keep responses small and stable because the frontend dashboard and tenant selector will depend on them.
