import 'dotenv/config'
import { z } from 'zod'

const requiredString = z.string().trim().min(1)

export const envSchema = z.object({
  DATABASE_URL: requiredString,
  AUTH_JWT_SECRET: requiredString,
  AUTH_JWT_ISSUER: requiredString,
  AUTH_JWT_AUDIENCE: requiredString,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(input)
}
