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
      AUTH_REFRESH_JWT_SECRET: '',
      AUTH_ACCESS_TOKEN_TTL_MINUTES: 60,
      AUTH_REFRESH_TOKEN_TTL_DAYS: 30,
      CORS_ALLOWED_ORIGINS: '',
      NODE_ENV: 'development',
      PORT: 3000,
    })
  })

  it('loads env values from a local .env file', async () => {
    const cwd = process.cwd()
    const originalEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
      AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
      AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
      AUTH_REFRESH_JWT_SECRET: process.env.AUTH_REFRESH_JWT_SECRET,
      AUTH_ACCESS_TOKEN_TTL_MINUTES: process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES,
      AUTH_REFRESH_TOKEN_TTL_DAYS: process.env.AUTH_REFRESH_TOKEN_TTL_DAYS,
      CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    }
    const tempDir = mkdtempSync(join(tmpdir(), 'sinapse3-env-'))
    writeFileSync(
      join(tempDir, '.env'),
      [
        'DATABASE_URL=postgresql://user:pass@localhost:5432/app?schema=core',
        'AUTH_JWT_SECRET=super-secret',
        'AUTH_JWT_ISSUER=sinapse3',
        'AUTH_JWT_AUDIENCE=sinapse3-web',
        'AUTH_REFRESH_JWT_SECRET=refresh-secret',
        'AUTH_ACCESS_TOKEN_TTL_MINUTES=45',
        'AUTH_REFRESH_TOKEN_TTL_DAYS=14',
        'CORS_ALLOWED_ORIGINS=https://dashboard.example.com, https://app.example.com',
        'NODE_ENV=development',
      ].join('\n'),
    )

    try {
      process.chdir(tempDir)
      delete process.env.DATABASE_URL
      delete process.env.AUTH_JWT_SECRET
      delete process.env.AUTH_JWT_ISSUER
      delete process.env.AUTH_JWT_AUDIENCE
      delete process.env.AUTH_REFRESH_JWT_SECRET
      delete process.env.AUTH_ACCESS_TOKEN_TTL_MINUTES
      delete process.env.AUTH_REFRESH_TOKEN_TTL_DAYS
      delete process.env.CORS_ALLOWED_ORIGINS
      delete process.env.NODE_ENV
      delete process.env.PORT
      jest.resetModules()
      const { loadEnv: reloadedLoadEnv } = await import('./env')

      expect(reloadedLoadEnv()).toEqual({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app?schema=core',
        AUTH_JWT_SECRET: 'super-secret',
        AUTH_JWT_ISSUER: 'sinapse3',
        AUTH_JWT_AUDIENCE: 'sinapse3-web',
        AUTH_REFRESH_JWT_SECRET: 'refresh-secret',
        AUTH_ACCESS_TOKEN_TTL_MINUTES: 45,
        AUTH_REFRESH_TOKEN_TTL_DAYS: 14,
        CORS_ALLOWED_ORIGINS: 'https://dashboard.example.com, https://app.example.com',
        NODE_ENV: 'development',
        PORT: 3000,
      })
    } finally {
      restoreEnvValue('DATABASE_URL', originalEnv.DATABASE_URL)
      restoreEnvValue('AUTH_JWT_SECRET', originalEnv.AUTH_JWT_SECRET)
      restoreEnvValue('AUTH_JWT_ISSUER', originalEnv.AUTH_JWT_ISSUER)
      restoreEnvValue('AUTH_JWT_AUDIENCE', originalEnv.AUTH_JWT_AUDIENCE)
      restoreEnvValue('AUTH_REFRESH_JWT_SECRET', originalEnv.AUTH_REFRESH_JWT_SECRET)
      restoreEnvValue('AUTH_ACCESS_TOKEN_TTL_MINUTES', originalEnv.AUTH_ACCESS_TOKEN_TTL_MINUTES)
      restoreEnvValue('AUTH_REFRESH_TOKEN_TTL_DAYS', originalEnv.AUTH_REFRESH_TOKEN_TTL_DAYS)
      restoreEnvValue('CORS_ALLOWED_ORIGINS', originalEnv.CORS_ALLOWED_ORIGINS)
      restoreEnvValue('NODE_ENV', originalEnv.NODE_ENV)
      restoreEnvValue('PORT', originalEnv.PORT)
      process.chdir(cwd)
    }
  })
})

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}
