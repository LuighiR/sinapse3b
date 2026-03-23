import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('prisma schema', () => {
  it('models the core budget fact and first kpi foundation tables', () => {
    const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

    expect(schema).toContain('schemas  = ["public", "core", "raw", "kpi"]')
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
})
