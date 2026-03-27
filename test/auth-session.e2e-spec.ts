import { randomBytes, scryptSync } from 'node:crypto'
import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'

describe('auth session', () => {
  it('returns access and refresh tokens for valid credentials', async () => {
    const app = await buildTestApp({
      users: [
        {
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
          passwordHash: hashPassword('secret-123'),
          isActive: true,
        },
      ],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'secret-123' })
        .expect(200)

      expect(response.body).toEqual({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresInSeconds: expect.any(Number),
        user: {
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
        },
        tenants: [
          {
            id: 't1',
            name: 'Ferraco Matriz',
            slug: 'ferraco-matriz',
            role: 'ADMIN',
            backendClientId: 'c1',
          },
        ],
      })

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
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

  it('rejects invalid credentials', async () => {
    const app = await buildTestApp({
      users: [
        {
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
          passwordHash: hashPassword('secret-123'),
          isActive: true,
        },
      ],
    })

    try {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'wrong-password' })
        .expect(401)
    } finally {
      await app.close()
    }
  })

  it('refreshes tokens from a valid refresh token', async () => {
    const app = await buildTestApp({
      users: [
        {
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
          passwordHash: hashPassword('secret-123'),
          isActive: true,
        },
      ],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'secret-123' })
        .expect(200)

      const refresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200)

      expect(refresh.body).toEqual({
        tokenType: 'Bearer',
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresInSeconds: expect.any(Number),
      })

      await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${refresh.body.accessToken}`)
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

  it('rejects using an access token as a refresh token', async () => {
    const app = await buildTestApp({
      users: [
        {
          id: 'u1',
          email: 'ana@example.com',
          name: 'Ana',
          passwordHash: hashPassword('secret-123'),
          isActive: true,
        },
      ],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      clients: [{ id: 'c1', name: 'Ferraco', isActive: true }],
    })

    try {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'secret-123' })
        .expect(200)

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.accessToken })
        .expect(401)
    } finally {
      await app.close()
    }
  })
})

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')

  return `scrypt$${salt}$${derivedKey}`
}
