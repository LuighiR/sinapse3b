import request from 'supertest'
import { TEST_FIXTURES, buildTestApp } from './helpers/build-test-app'
import { buildJwt } from './helpers/fakes'

describe('companies', () => {
  it('registers test fixtures in the application container for later consumers', async () => {
    const app = await buildTestApp({
      tenants: [{ id: 't1', backendClientId: 'c1' }],
    })

    try {
      expect(app.get(TEST_FIXTURES)).toMatchObject({
        tenants: [{ id: 't1', backendClientId: 'c1' }],
      })
    } finally {
      await app.close()
    }
  })

  it('returns the current company from the active tenant scope', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', name: 'Ana', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true, role: 'ADMIN' }],
      tenants: [{ id: 't1', name: 'Ferraco Matriz', slug: 'ferraco-matriz', backendClientId: 'c1', isActive: true }],
      clients: [{ id: 'c1', name: 'Ferraco', slug: 'ferraco', isActive: true }],
    })

    try {
      await request(app.getHttpServer())
        .get('/companies/current')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(200)
        .expect({
          id: 'c1',
          name: 'Ferraco',
          slug: 'ferraco',
        })
    } finally {
      await app.close()
    }
  })

  it('returns branches only for the current company', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
      clients: [
        { id: 'c1', name: 'Ferraco', isActive: true },
        { id: 'c2', name: 'Outra Empresa', isActive: true },
      ],
      branches: [
        { id: 11, name: 'Filial', address: 'Rua B', phone: '2222', cnpj: '22', clientId: 'c1', erpId: 200n },
        { id: 10, name: 'Matriz', address: 'Rua A', phone: '1111', cnpj: '11', clientId: 'c1', erpId: 100n },
        { id: 99, name: 'Fora do Escopo', address: 'Rua Z', phone: '9999', cnpj: '99', clientId: 'c2', erpId: 999n },
      ],
    })

    try {
      await request(app.getHttpServer())
        .get('/companies/current/branches')
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(200)
        .expect([
          {
            id: 10,
            name: 'Matriz',
            address: 'Rua A',
            phone: '1111',
            cnpj: '11',
            clientId: 'c1',
          },
          {
            id: 11,
            name: 'Filial',
            address: 'Rua B',
            phone: '2222',
            cnpj: '22',
            clientId: 'c1',
          },
        ])
    } finally {
      await app.close()
    }
  })

  it('returns employees for the current company and supports branch and search filters', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
      clients: [
        { id: 'c1', name: 'Ferraco', isActive: true },
        { id: 'c2', name: 'Outra Empresa', isActive: true },
      ],
      branches: [
        { id: 10, name: 'Matriz', clientId: 'c1', erpId: 100n },
        { id: 11, name: 'Filial', clientId: 'c1', erpId: 101n },
        { id: 99, name: 'Fora do Escopo', clientId: 'c2', erpId: 999n },
      ],
      employees: [
        {
          id: 20,
          name: 'Maria Silva',
          branchId: 10,
          extensionNumber: '101',
          extensionUuid: 'ext-101',
          erpId: 500n,
          chatId: 'chat-20',
          isNonCommercial: true,
        },
        {
          id: 21,
          name: 'Marina Costa',
          branchId: 11,
          extensionNumber: '102',
          extensionUuid: 'ext-102',
          erpId: 501n,
          chatId: 'chat-21',
        },
        {
          id: 99,
          name: 'Mario Externo',
          branchId: 99,
          extensionNumber: '999',
          extensionUuid: 'ext-999',
          erpId: 999n,
          chatId: 'chat-99',
        },
      ],
    })

    try {
      await request(app.getHttpServer())
        .get('/companies/current/employees')
        .query({ branchId: 10, search: 'mari' })
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(200)
        .expect([
          {
            id: 20,
            erpId: 500,
            name: 'Maria Silva',
            branchId: 10,
            extensionNumber: '101',
            extensionUuid: 'ext-101',
            chatId: 'chat-20',
            isNonCommercial: true,
          },
        ])
    } finally {
      await app.close()
    }
  })

  it('rejects employee queries for a branch outside the active client scope', async () => {
    const app = await buildTestApp({
      users: [{ id: 'u1', email: 'ana@example.com', isActive: true }],
      memberships: [{ userId: 'u1', tenantId: 't1', isActive: true }],
      tenants: [{ id: 't1', backendClientId: 'c1', isActive: true }],
      clients: [
        { id: 'c1', name: 'Ferraco', isActive: true },
        { id: 'c2', name: 'Outra Empresa', isActive: true },
      ],
      branches: [
        { id: 10, name: 'Matriz', clientId: 'c1', erpId: 100n },
        { id: 99, name: 'Fora do Escopo', clientId: 'c2', erpId: 999n },
      ],
      employees: [{ id: 20, name: 'Maria Silva', branchId: 10 }],
    })

    try {
      await request(app.getHttpServer())
        .get('/companies/current/employees')
        .query({ branchId: 99 })
        .set('Authorization', `Bearer ${await buildJwt({ sub: 'u1' })}`)
        .set('X-Tenant-Id', 't1')
        .expect(403)
    } finally {
      await app.close()
    }
  })
})
