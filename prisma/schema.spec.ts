import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('prisma schema', () => {
  it('models the core budget fact and first kpi foundation tables', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('schemas  = ["public", "core", "raw", "kpi"]')
    expect(schema).toContain('model CallFact')
    expect(schema).toContain('model BudgetFact')
    expect(schema).toContain('@@schema("core")')
    expect(schema).toContain('model KpiDefinition')
    expect(schema).toContain('model KpiAvailability')
    expect(schema).toContain('model KpiSnapshot')
    expect(schema).toContain('model KpiBreakdown')
    expect(schema).toContain('model KpiCalculationRun')
    expect(schema).toContain('model KpiDrilldownRef')
    expect(schema).toContain('@@schema("kpi")')
  })

  it('maps the whatsapp conversational core tables', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('model Session')
    expect(schema).toContain('model Message')
    expect(schema).toContain('model Ticket')
    expect(schema).toContain('model Contact')
    expect(schema).toContain('model Tag')
    expect(schema).toContain('model ContactTag')
    expect(schema).toContain('enum SessionType')
    expect(schema).toContain('enum MessageSenderType')
  })

  it('models the core refresh jobs table for asynchronous KPI refresh execution', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('model RefreshJob')
    expect(schema).toContain('tenantId')
    expect(schema).toContain('clientId')
    expect(schema).toContain('triggerType')
    expect(schema).toContain('requestedFrom')
    expect(schema).toContain('requestedTo')
    expect(schema).toContain('status')
    expect(schema).toContain('requestedAt')
    expect(schema).toContain('startedAt')
    expect(schema).toContain('finishedAt')
    expect(schema).toContain('errorMessage')
    expect(schema).toContain('resultsJson')
    expect(schema).toContain('@@map("refresh_jobs")')
    expect(schema).toContain('@@schema("core")')
  })

  it('maps the employee non-commercial flag to core employees', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('model Employee')
    expect(schema).toContain('isNonCommercial Boolean  @default(false) @map("is_non_commercial")')
    expect(schema).toContain('@@map("employees")')
  })

  it('keeps a single erpId on Employee and has no EmployeeErpUser model', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).not.toContain('model EmployeeErpUser')
    expect(schema).not.toContain('@@map("employee_erp_users")')
    expect(schema).toMatch(/model Employee \{[^}]*erpId\s+BigInt/s)
  })

  it('maps raw FLW messaging tables and sync state', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('model FlwSessionRaw')
    expect(schema).toContain('model FlwMessageRaw')
    expect(schema).toContain('model MessagingSyncState')
    expect(schema).toContain('lastNormalizedAt')
    expect(schema).toContain('@@schema("raw")')
  })

  it('maps canonical messaging tables and branch FLW department id', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('model MessagingSession')
    expect(schema).toContain('model MessagingMessage')
    expect(schema).toContain('model MessagingContact')
    expect(schema).toContain('legacyContactId')
    expect(schema).toContain('contactId')
    expect(schema).toContain('flwDepartmentId')
    expect(schema).toContain('enum MessagingProvider')
  })
})
