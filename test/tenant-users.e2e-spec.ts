import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import { buildJwt } from './helpers/fakes'

describe('tenant users', () => {
  it('lists tenant users for owner and admin memberships', async () => {
    const app = await buildTestApp({
      users: [
        { id: 'u-admin', email: 'admin@example.com', name: 'Admin', isActive: true },
        { id: 'u-owner', email: 'owner@example.com', name: 'Owner', isActive: true },
        { id: 'u-viewer', email: 'viewer@example.com', name: 'Viewer', isActive: true },
        { id: 'u-inactive', email: 'inactive@example.com', name: 'Inactive', isActive: false },
      ],
      tenants: [
        { id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true },
        { id: 't2', name: 'Ferraco Filial', slug: 'ferraco-filial', backendClientId: 'c2', isActive: true },
      ],
      memberships: [
        { userId: 'u-admin', tenantId: 't1', role: 'ADMIN', isActive: true },
        { userId: 'u-owner', tenantId: 't1', role: 'OWNER', isActive: true },
        { userId: 'u-viewer', tenantId: 't1', role: 'VIEWER', isActive: true },
        { userId: 'u-inactive', tenantId: 't1', role: 'MANAGER', isActive: false },
        { userId: 'u-viewer', tenantId: 't2', role: 'ADMIN', isActive: true },
      ],
      clients: [
        { id: 'c1', name: 'Ferraco', isActive: true },
        { id: 'c2', name: 'Ferraco 2', isActive: true },
      ],
    })

    try {
      await request(app.getHttpServer())
        .get('/tenant-users')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u-admin' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(200)
        .expect([
          {
            id: 'u-admin',
            email: 'admin@example.com',
            name: 'Admin',
            isActive: true,
            role: 'ADMIN',
            membershipIsActive: true,
          },
          {
            id: 'u-inactive',
            email: 'inactive@example.com',
            name: 'Inactive',
            isActive: false,
            role: 'MANAGER',
            membershipIsActive: false,
          },
          {
            id: 'u-owner',
            email: 'owner@example.com',
            name: 'Owner',
            isActive: true,
            role: 'OWNER',
            membershipIsActive: true,
          },
          {
            id: 'u-viewer',
            email: 'viewer@example.com',
            name: 'Viewer',
            isActive: true,
            role: 'VIEWER',
            membershipIsActive: true,
          },
        ])
    } finally {
      await app.close()
    }
  })

  it('rejects tenant user administration for non-owner-admin memberships', async () => {
    const app = await buildTestApp({
      users: [
        { id: 'u-manager', email: 'manager@example.com', name: 'Manager', isActive: true },
      ],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u-manager', tenantId: 't1', role: 'MANAGER', isActive: true }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/tenant-users')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u-manager' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(403)
    } finally {
      await app.close()
    }
  })

  it('creates a tenant user and allows the new password to authenticate', async () => {
    const users = [{ id: 'u-admin', email: 'admin@example.com', name: 'Admin', isActive: true }]
    const memberships = [{ userId: 'u-admin', tenantId: 't1', role: 'ADMIN' as const, isActive: true }]
    const app = await buildTestApp({
      users,
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships,
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      const response = await request(app.getHttpServer())
        .post('/tenant-users')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u-admin' })}`)
        .set('X-Tenant-Id', 't1')
        .send({
          email: 'new.user@example.com',
          name: 'New User',
          password: 'secret-123',
          role: 'VIEWER',
        })
        .expect(201)

      expect(response.body).toEqual({
        id: expect.any(String),
        email: 'new.user@example.com',
        name: 'New User',
        isActive: true,
        role: 'VIEWER',
        membershipIsActive: true,
      })

      expect(users).toHaveLength(2)
      expect(users[1]).toMatchObject({
        email: 'new.user@example.com',
        name: 'New User',
        isActive: true,
      })
      expect(memberships).toHaveLength(2)
      expect(memberships[1]).toMatchObject({
        tenantId: 't1',
        userId: response.body.id,
        role: 'VIEWER',
        isActive: true,
      })

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'new.user@example.com', password: 'secret-123' })
        .expect(200)
    } finally {
      await app.close()
    }
  })

  it('updates a tenant user membership and password', async () => {
    const users = [
      { id: 'u-admin', email: 'admin@example.com', name: 'Admin', passwordHash: hashPassword('admin-123'), isActive: true },
      { id: 'u-viewer', email: 'viewer@example.com', name: 'Viewer', passwordHash: hashPassword('before-123'), isActive: true },
    ]
    const memberships = [
      { userId: 'u-admin', tenantId: 't1', role: 'ADMIN' as const, isActive: true },
      { userId: 'u-viewer', tenantId: 't1', role: 'VIEWER' as const, isActive: true },
    ]
    const app = await buildTestApp({
      users,
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships,
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      const response = await request(app.getHttpServer())
        .patch('/tenant-users/u-viewer')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u-admin' })}`)
        .set('X-Tenant-Id', 't1')
        .send({
          name: 'Viewer Updated',
          password: 'after-123',
          role: 'MANAGER',
          isActive: true,
          membershipIsActive: false,
        })
        .expect(200)

      expect(response.body).toEqual({
        id: 'u-viewer',
        email: 'viewer@example.com',
        name: 'Viewer Updated',
        isActive: true,
        role: 'MANAGER',
        membershipIsActive: false,
      })

      expect(users[1]).toMatchObject({
        id: 'u-viewer',
        email: 'viewer@example.com',
        name: 'Viewer Updated',
        isActive: true,
      })
      expect(memberships[1]).toMatchObject({
        userId: 'u-viewer',
        tenantId: 't1',
        role: 'MANAGER',
        isActive: false,
      })

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'viewer@example.com', password: 'before-123' })
        .expect(401)

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'viewer@example.com', password: 'after-123' })
        .expect(200)
    } finally {
      await app.close()
    }
  })
})

function hashPassword(password: string): string {
  const { randomBytes, scryptSync } = require('node:crypto') as typeof import('node:crypto')
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')

  return `scrypt$${salt}$${derivedKey}`
}
