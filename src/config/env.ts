import 'dotenv/config'
import { z } from 'zod'

const requiredString = z.string().trim().min(1)

export const envSchema = z.object({
  DATABASE_URL: requiredString,
  AUTH_JWT_SECRET: requiredString,
  AUTH_JWT_ISSUER: requiredString,
  AUTH_JWT_AUDIENCE: requiredString,
  INTERNAL_JOB_KEY: requiredString,
  BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL: z.string().default('').transform((value) => value.trim()),
  AUTH_REFRESH_JWT_SECRET: z.string().default('').transform((value) => value.trim()),
  AUTH_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  CORS_ALLOWED_ORIGINS: z.string().default('').transform((value) => value.trim()),
  FLW_CHAT_API_BASE_URL: z.string().default('https://api.wts.chat/chat').transform((v) => v.trim()),
  FLW_CHAT_CORE_BASE_URL: z.string().default('https://api.wts.chat/core').transform((v) => v.trim()),
  FLW_CHAT_API_TOKEN: z.string().default('').transform((v) => v.trim()),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(input)
}
