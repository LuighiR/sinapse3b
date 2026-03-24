import { SignJWT } from 'jose'

export const TEST_AUTH_JWT_SECRET = 'test-secret-with-at-least-32-chars'
export const TEST_AUTH_JWT_ISSUER = 'sinapse-next'
export const TEST_AUTH_JWT_AUDIENCE = 'sinapse-kpi-api'
export const TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/sinapse3?schema=core'

const TEST_SECRET = new TextEncoder().encode(TEST_AUTH_JWT_SECRET)

export type TestUser = {
  id: string
  email: string
  name?: string | null
  passwordHash?: string
  isSuperAdmin?: boolean
  isActive?: boolean
}

export type TestTenant = {
  id: string
  name?: string
  slug?: string
  isActive?: boolean
  backendClientId?: string | null
}

export type TestMembership = {
  id?: string
  tenantId: string
  userId: string
  role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'VIEWER'
  isActive?: boolean
}

export type TestClient = {
  id: string
  slug?: string
  name: string
  domainUuid?: string
  apiBaseUrl?: string
  apiKey?: string
  isActive?: boolean
}

export type TestBranch = {
  id: number
  name?: string
  address?: string
  phone?: string
  cnpj?: string
  clientId: string
  erpId?: bigint
}

export type TestEmployee = {
  id: number
  name: string
  extensionNumber?: string
  extensionUuid?: string
  erpId?: bigint
  chatId?: string
  branchId: number
}

export type TestFixtures = {
  users?: TestUser[]
  tenants?: TestTenant[]
  memberships?: TestMembership[]
  clients?: TestClient[]
  branches?: TestBranch[]
  employees?: TestEmployee[]
}

type TestJwtPayload = {
  sub: string
  exp?: number
  [claim: string]: unknown
}

function assertJwtSubject(payload: Partial<TestJwtPayload>): asserts payload is TestJwtPayload {
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new Error('buildJwt requires a non-empty "sub" claim')
  }
}

export function buildJwt(payload: Partial<TestJwtPayload>) {
  assertJwtSubject(payload)

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(TEST_AUTH_JWT_ISSUER)
    .setAudience(TEST_AUTH_JWT_AUDIENCE)

  if (payload.exp === undefined) {
    jwt.setExpirationTime('1h')
  }

  return jwt.sign(TEST_SECRET)
}

export function ensureTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = TEST_DATABASE_URL
  process.env.AUTH_JWT_SECRET = TEST_AUTH_JWT_SECRET
  process.env.AUTH_JWT_ISSUER = TEST_AUTH_JWT_ISSUER
  process.env.AUTH_JWT_AUDIENCE = TEST_AUTH_JWT_AUDIENCE
}

export function createTestFixtures(input: TestFixtures = {}) {
  return {
    users: input.users ?? [],
    tenants: input.tenants ?? [],
    memberships: input.memberships ?? [],
    clients: input.clients ?? [],
    branches: input.branches ?? [],
    employees: input.employees ?? [],
  }
}
