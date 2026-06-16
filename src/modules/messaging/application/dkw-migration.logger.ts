export function logDkwMigrationStarted(input: {
  clientId: string
  from: string
  to: string
  batchSize: number
  windowsTotal: number
}): void {
  console.log('[dkw-migrate] started', input)
}

export function logDkwMigrationWindowStarted(input: {
  clientId: string
  windowIndex: number
  windowsTotal: number
  from: string
  to: string
}): void {
  console.log('[dkw-migrate] window started', input)
}

export function logDkwMigrationWindowCompleted(input: {
  clientId: string
  windowIndex: number
  windowsTotal: number
  from: string
  to: string
  messagesExpected: number
  messagesWritten: number
  messagesSkippedMissingSession: number
  batchesProcessed: number
}): void {
  console.log('[dkw-migrate] window completed', input)
}

export function logDkwMigrationCompleted(input: {
  clientId: string
  from: string
  to: string
  windowsProcessed: number
  messagesWritten: number
}): void {
  console.log('[dkw-migrate] completed', input)
}
