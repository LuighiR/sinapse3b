export type NormalizedBudgetStatus = 'OPEN' | 'WON' | 'LOST' | 'UNKNOWN'

const STATUS_MAP: Record<string, NormalizedBudgetStatus> = {
  Baixado: 'WON',
  Fechado: 'WON',
  Pendente: 'OPEN',
  Cancelado: 'LOST',
}

export function mapBudgetStatus(statusRaw: string | null | undefined): NormalizedBudgetStatus {
  if (statusRaw == null) {
    return 'UNKNOWN'
  }

  return STATUS_MAP[statusRaw] ?? 'UNKNOWN'
}
