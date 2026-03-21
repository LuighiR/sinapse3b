import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt } from './helpers/fakes'

describe('me', () => {
  it('returns the resolved auth context', async () => {
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

  it('returns the authenticated user summary', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .expect(200)
        .expect({
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
        })
    } finally {
      await app.close()
    }
  })

  it('returns the authenticated user active tenants with role and backend client id', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', isActive: true }],
      tenants: [
        { id: 't2', name: 'Ferraco Filial', slug: 'ferraco-filial', backendClientId: 'c2', isActive: true },
        { id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true },
        { id: 't3', name: 'Ferraco Inativa', slug: 'ferraco-inativa', backendClientId: 'c3', isActive: false },
        { id: 't4', name: 'Ferraco Sem Cliente', slug: 'ferraco-sem-cliente', backendClientId: null, isActive: true },
        { id: 't5', name: 'Ferraco Cliente Inativo', slug: 'ferraco-cliente-inativo', backendClientId: 'c5', isActive: true },
      ],
      memberships: [
        { userId: 'u1', tenantId: 't5', isActive: true, role: 'MANAGER' },
        { userId: 'u1', tenantId: 't2', isActive: true, role: 'VIEWER' },
        { userId: 'u1', tenantId: 't3', isActive: true, role: 'MANAGER' },
        { userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' },
        { userId: 'u1', tenantId: 't4', isActive: true, role: 'OWNER' },
        { userId: 'u1', tenantId: 't6', isActive: false, role: 'OWNER' },
      ],
      clients: [
        { id: 'c1', name: 'Ferraco', isActive: true },
        { id: 'c2', name: 'Ferraco 2', isActive: true },
        { id: 'c3', name: 'Ferraco 3', isActive: true },
        { id: 'c5', name: 'Ferraco 5', isActive: false },
      ],
    })

    try {
      await request(app.getHttpServer())
        .get('/me/tenants')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .expect(200)
        .expect([
          {
            id: 't1',
            name: 'Ferraco Matriz',
            slug: 'ferraco-matriz',
            role: 'ADMIN',
            backendClientId: 'c1',
          },
          {
            id: 't2',
            name: 'Ferraco Filial',
            slug: 'ferraco-filial',
            role: 'VIEWER',
            backendClientId: 'c2',
          },
        ])
    } finally {
      await app.close()
    }
  })
})
