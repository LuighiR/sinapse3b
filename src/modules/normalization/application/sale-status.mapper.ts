export type NormalizedSaleStatus = 'VALID' | 'CANCELED' | 'UNKNOWN'

export function mapSaleStatus(rawStatus: string | null): NormalizedSaleStatus {
  const normalized = rawStatus?.trim().toUpperCase()

  if (normalized === 'N') {
    return 'VALID'
  }

  if (normalized === 'S') {
    return 'CANCELED'
  }

  return 'UNKNOWN'
}
