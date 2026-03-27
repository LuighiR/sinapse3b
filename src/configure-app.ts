import { INestApplication } from '@nestjs/common'
import type { Env } from './config/env'

const DEFAULT_LOCAL_CORS_ORIGINS = ['http://localhost:3001']

export function configureApp(app: INestApplication, env: Env) {
  const corsOrigins = resolveCorsOrigins(env)

  if (corsOrigins.length === 0) {
    return
  }

  app.enableCors({
    origin: corsOrigins,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  })
}

function resolveCorsOrigins(env: Env) {
  if (env.CORS_ALLOWED_ORIGINS !== '') {
    return env.CORS_ALLOWED_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== '')
  }

  if (env.NODE_ENV === 'production') {
    return []
  }

  return DEFAULT_LOCAL_CORS_ORIGINS
}
