import { Test } from '@nestjs/testing'
import {
  BUDGET_FACT_UPSERT_REPOSITORY,
  BudgetNormalizationService,
  PrismaBudgetFactUpsertRepository,
  PrismaRawFerracoBudgetReader,
  RAW_FERRACO_BUDGET_READER,
  type BudgetFactUpsertRepository,
  type RawFerracoBudgetReader,
} from './budget-normalization.service'
import { mapBudgetStatus } from './budget-status.mapper'

describe('mapBudgetStatus', () => {
  it.each([
    ['Baixado', 'WON'],
    ['Pendente', 'OPEN'],
    ['Cancelado', 'LOST'],
    ['Fechado', 'WON'],
    [null, 'UNKNOWN'],
  ])('maps %p to %p', (rawStatus, expected) => {
    expect(mapBudgetStatus(rawStatus)).toBe(expected)
  })
})

describe('BudgetNormalizationService', () => {
  it('maps branchId from the seller ERP lookup when the seller belongs to a unique branch', async () => {
    const rawReader: RawFerracoBudgetReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 42,
          clientId: 'client-1',
          branch: '3',
          sellerId: 7,
          sellerName: 'Maria',
          openingDate: '2026-01-10',
          openingTime: '08:15:00',
          cancellationDate: '2026-01-12',
          cancelationTime: '14:20:00',
          closingDate: '2026-01-15',
          closingTime: '16:45:00',
          status: 'Baixado',
          channel: 'SHOWROOM',
          customerName: 'Cliente Teste',
          cpfCnpj: '12345678900',
          value: '1200.50',
          sequential: '1001',
          davId: '2002',
          sequentialLinkedSale: '3003',
          payload: { source: 'fixture' },
        },
      ]),
    }

    const budgetFactRepository: BudgetFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const employeeBranchLookup = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          sellerId: 7,
          branchId: 2,
          branchName: 'FerraçoSul - Pelotas',
        },
      ]),
    }

    const service = new BudgetNormalizationService(rawReader, budgetFactRepository, employeeBranchLookup as any)

    await service.normalizeClientBudgets('client-1')

    expect(employeeBranchLookup.findByClientId).toHaveBeenCalledWith('client-1')

    const [upsertArgs] = (budgetFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs.create).toMatchObject({
      branchId: 2,
      branchName: 'FerraçoSul - Pelotas',
      sellerId: 7,
    })
    expect(upsertArgs.update).toMatchObject({
      branchId: 2,
      branchName: 'FerraçoSul - Pelotas',
      sellerId: 7,
    })
  })

  it('normalizes raw ferraco budgets for the provided client and upserts canonical facts', async () => {
    const rawReader: RawFerracoBudgetReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 42,
          clientId: 'client-1',
          branch: '3',
          sellerId: 7,
          sellerName: 'Maria',
          openingDate: '2026-01-10',
          openingTime: '08:15:00',
          cancellationDate: '2026-01-12',
          cancelationTime: '14:20:00',
          closingDate: '2026-01-15',
          closingTime: '16:45:00',
          status: 'Baixado',
          channel: 'SHOWROOM',
          customerName: 'Cliente Teste',
          cpfCnpj: '12345678900',
          value: '1200.50',
          sequential: '1001',
          davId: '2002',
          sequentialLinkedSale: '3003',
          payload: { source: 'fixture' },
        },
      ]),
    }

    const budgetFactRepository: BudgetFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new BudgetNormalizationService(rawReader, budgetFactRepository)

    const result = await service.normalizeClientBudgets('client-1')

    expect(rawReader.findByClientId).toHaveBeenCalledWith('client-1')
    expect(result).toEqual({ recordsRead: 1, recordsWritten: 1 })
    expect(budgetFactRepository.upsert).toHaveBeenCalledTimes(1)

    const [upsertArgs] = (budgetFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs).toMatchObject({
      where: {
        clientId_sourceTable_sourceRecordId: {
          clientId: 'client-1',
          sourceTable: 'raw.ferraco_budgets',
          sourceRecordId: 42,
        },
      },
      create: {
        clientId: 'client-1',
        sourceTable: 'raw.ferraco_budgets',
        sourceRecordId: 42,
        branchId: null,
        branchName: '3',
        sellerId: 7,
        sellerName: 'Maria',
        budgetDate: new Date(2026, 0, 10),
        budgetDatetime: new Date(2026, 0, 10, 8, 15, 0),
        cancellationDate: new Date(2026, 0, 12),
        cancelationTime: '14:20:00',
        closingDate: new Date(2026, 0, 15),
        statusRaw: 'Baixado',
        statusNormalized: 'WON',
        channel: 'SHOWROOM',
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        davId: BigInt(2002),
        sequentialLinkedSale: BigInt(3003),
        payloadJson: { source: 'fixture', closing_time: '16:45:00' },
      },
      update: {
        branchId: null,
        branchName: '3',
        sellerId: 7,
        sellerName: 'Maria',
        budgetDate: new Date(2026, 0, 10),
        budgetDatetime: new Date(2026, 0, 10, 8, 15, 0),
        cancellationDate: new Date(2026, 0, 12),
        cancelationTime: '14:20:00',
        closingDate: new Date(2026, 0, 15),
        statusRaw: 'Baixado',
        statusNormalized: 'WON',
        channel: 'SHOWROOM',
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        davId: BigInt(2002),
        sequentialLinkedSale: BigInt(3003),
        payloadJson: { source: 'fixture', closing_time: '16:45:00' },
      },
    })

    expect(upsertArgs.create.valueAmount.toString()).toBe('1200.50')
    expect(upsertArgs.update.valueAmount.toString()).toBe('1200.50')
  })

  it('omits cancelation_time from payloadJson when the raw field is empty', async () => {
    const rawReader: RawFerracoBudgetReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 43,
          clientId: 'client-1',
          branch: '3',
          sellerId: 7,
          sellerName: 'Maria',
          openingDate: '2026-01-10',
          openingTime: '08:15:00',
          cancellationDate: '2026-01-12',
          cancelationTime: '',
          closingDate: null,
          closingTime: null,
          status: 'Pendente',
          channel: 'SHOWROOM',
          customerName: 'Cliente Teste',
          cpfCnpj: '12345678900',
          value: '1200.50',
          sequential: null,
          davId: '2002',
          sequentialLinkedSale: null,
          payload: { source: 'fixture' },
        },
      ]),
    }

    const budgetFactRepository: BudgetFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new BudgetNormalizationService(rawReader, budgetFactRepository)

    await service.normalizeClientBudgets('client-1')

    const [upsertArgs] = (budgetFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs.create.payloadJson).toEqual({ source: 'fixture' })
  })

  it('preserves the calendar day when raw date columns arrive as Date objects', async () => {
    const rawReader: RawFerracoBudgetReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 99,
          clientId: 'client-1',
          branch: 'Matriz',
          sellerId: 11,
          sellerName: 'Joana',
          openingDate: new Date(Date.UTC(2026, 0, 2, 0, 0, 0)),
          openingTime: '10:30:00',
          closingDate: new Date(Date.UTC(2026, 0, 5, 0, 0, 0)),
          closingTime: '18:15:00',
          status: 'Pendente',
          channel: 'BALCAO',
          customerName: 'Cliente UTC',
          cpfCnpj: null,
          value: '10.00',
          sequential: null,
          davId: '5001',
          sequentialLinkedSale: null,
          payload: { source: 'date-object' },
        },
      ]),
    }

    const budgetFactRepository: BudgetFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new BudgetNormalizationService(rawReader, budgetFactRepository)

    await service.normalizeClientBudgets('client-1')

    const [upsertArgs] = (budgetFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs.create.budgetDate).toEqual(new Date(2026, 0, 2))
    expect(upsertArgs.create.closingDate).toEqual(new Date(2026, 0, 5))
    expect(upsertArgs.create.budgetDatetime).toEqual(new Date(2026, 0, 2, 10, 30, 0))
  })

  it('fails fast when Nest dependencies are not wired', async () => {
    await expect(
      Test.createTestingModule({
        providers: [BudgetNormalizationService],
      }).compile(),
    ).rejects.toThrow()
  })

  it('resolves cleanly when explicit reader and repository providers are wired', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetNormalizationService,
        {
          provide: RAW_FERRACO_BUDGET_READER,
          useValue: {
            findByClientId: jest.fn().mockResolvedValue([]),
          } satisfies RawFerracoBudgetReader,
        },
        {
          provide: BUDGET_FACT_UPSERT_REPOSITORY,
          useValue: {
            upsert: jest.fn().mockResolvedValue(undefined),
          } satisfies BudgetFactUpsertRepository,
        },
      ],
    }).compile()

    expect(moduleRef.get(BudgetNormalizationService)).toBeInstanceOf(BudgetNormalizationService)
  })

  it('reads cancellation fields from raw ferraco budgets in the query reader', async () => {
    const queryRaw = jest.fn().mockResolvedValue([])
    const reader = new PrismaRawFerracoBudgetReader({
      $queryRaw: queryRaw,
    } as never)

    await reader.findByClientId('client-1')

    expect(queryRaw).toHaveBeenCalledTimes(1)

    const [queryParts, clientId] = queryRaw.mock.calls[0] as [TemplateStringsArray, string]
    const sql = queryParts.join('?')

    expect(clientId).toBe('client-1')
    expect(sql).toContain('budget.cancellation_date AS "cancellationDate"')
    expect(sql).toContain('budget.cancellation_time::text AS "cancelationTime"')
  })
})

describe('PrismaBudgetFactUpsertRepository', () => {
  it('coalesces nullable raw text fields during bulk upsert to match canonical constraints', async () => {
    const executeRaw = jest.fn().mockResolvedValue(undefined)
    const repository = new PrismaBudgetFactUpsertRepository({
      $executeRaw: executeRaw,
    } as never)

    await repository.bulkUpsertClient('ferracosul')

    expect(executeRaw).toHaveBeenCalledTimes(1)

    const [queryParts, clientId] = executeRaw.mock.calls[0] as [TemplateStringsArray, string]
    const sql = queryParts.join('?')

    expect(clientId).toBe('ferracosul')
    expect(sql).toContain('employee_branch_lookup')
    expect(sql).toContain('employee_erp_users')
    expect(sql).toContain('eu.erp_id')
    expect(sql).toContain('branch_id')
    expect(sql).toContain("COALESCE(budget.branch, '')")
    expect(sql).toContain("COALESCE(budget.seller_name, '')")
    expect(sql).toContain("COALESCE(budget.customer_name, '')")
    expect(sql).toContain('cancellation_date')
    expect(sql).toContain('cancelation_time')
    expect(sql).toContain('budget.cancellation_time')
  })
})
