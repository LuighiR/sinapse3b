import request from 'supertest'
import { buildTestApp } from './helpers/build-test-app'

describe('bootstrap', () => {
  it('GET /health returns ok', async () => {
    const app = await buildTestApp()

    try {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' })
    } finally {
      await app.close()
    }
  })
})
