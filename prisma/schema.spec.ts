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
})
