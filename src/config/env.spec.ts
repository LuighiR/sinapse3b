import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadEnv } from './env'

describe('loadEnv', () => {
  it('fills defaults while requiring core secrets', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      AUTH_JWT_SECRET: 'super-secret',
      AUTH_JWT_ISSUER: 'sinapse3',
      AUTH_JWT_AUDIENCE: 'sinapse3-web',
    })

    expect(env).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      AUTH_JWT_SECRET: 'super-secret',
      AUTH_JWT_ISSUER: 'sinapse3',
      AUTH_JWT_AUDIENCE: 'sinapse3-web',
      NODE_ENV: 'development',
      PORT: 3000,
    })
  })

  it('loads env values from a local .env file', async () => {
    const cwd = process.cwd()
    const originalNodeEnv = process.env.NODE_ENV
    const tempDir = mkdtempSync(join(tmpdir(), 'sinapse3-env-'))
    writeFileSync(
      join(tempDir, '.env'),
      [
        'DATABASE_URL=postgresql://user:pass@localhost:5432/app?schema=core',
        'AUTH_JWT_SECRET=super-secret',
        'AUTH_JWT_ISSUER=sinapse3',
        'AUTH_JWT_AUDIENCE=sinapse3-web',
        'NODE_ENV=development',
      ].join('\n'),
    )

    try {
      process.chdir(tempDir)
      delete process.env.NODE_ENV
      jest.resetModules()
      const { loadEnv: reloadedLoadEnv } = await import('./env')

      expect(reloadedLoadEnv()).toEqual({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app?schema=core',
        AUTH_JWT_SECRET: 'super-secret',
        AUTH_JWT_ISSUER: 'sinapse3',
        AUTH_JWT_AUDIENCE: 'sinapse3-web',
        NODE_ENV: 'development',
        PORT: 3000,
      })
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = originalNodeEnv
      }
      process.chdir(cwd)
    }
  })
})
