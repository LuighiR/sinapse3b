import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt } from './helpers/fakes'

describe('auth context', () => {
  it('rejects requests without a bearer token', async () => {
    const app = await buildTestApp()

    try {
      await request(app.getHttpServer()).get('/auth/context').expect(401)
    } finally {
      await app.close()
    }
  })

  it('rejects requests without X-Tenant-Id', async () => {
    const app = await buildTestApp()

    try {
      await request(app.getHttpServer())
        .get('/auth/context')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .expect(400)
    } finally {
      await app.close()
    }
  })

  it('rejects requests when the resolved backend client is inactive', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: false }],
    })

    try {
      await request(app.getHttpServer())
        .get('/auth/context')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(403)
    } finally {
      await app.close()
    }
  })

  it('rejects requests when the membership is inactive', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: false, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/auth/context')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(403)
    } finally {
      await app.close()
    }
  })

  it('rejects requests when the tenant is inactive', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: false }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/auth/context')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(403)
    } finally {
      await app.close()
    }
  })

  it('returns the resolved request context for an active membership and tenant scope', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', isActive: true }],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/auth/context')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(200)
        .expect({
          user: { id: 'u1', email: 'ana@example.com', name: 'Ana' },
          tenant: { id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz' },
          client: { id: 'c1', name: 'Ferraco' },
          membership: { role: 'ADMIN' },
        })
    } finally {
      await app.close()
    }
  })
})
