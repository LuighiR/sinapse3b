import { loadEnv } from '../../../config/env'

export type WhatsAppKpiSource = 'legacy' | 'canonical' | 'dual'

export function getWhatsAppKpiSource(env: NodeJS.ProcessEnv = process.env): WhatsAppKpiSource {
  return loadEnv(env).WHATSAPP_KPI_SOURCE
}
