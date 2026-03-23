import { Test } from '@nestjs/testing'
import {
  BUDGET_FACT_UPSERT_REPOSITORY,
  BudgetNormalizationService,
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
          closingDate: '2026-01-15',
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
        closingDate: new Date(2026, 0, 15),
        statusRaw: 'Baixado',
        statusNormalized: 'WON',
        channel: 'SHOWROOM',
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        davId: BigInt(2002),
        sequentialLinkedSale: BigInt(3003),
        payloadJson: { source: 'fixture' },
      },
      update: {
        branchId: null,
        branchName: '3',
        sellerId: 7,
        sellerName: 'Maria',
        budgetDate: new Date(2026, 0, 10),
        budgetDatetime: new Date(2026, 0, 10, 8, 15, 0),
        closingDate: new Date(2026, 0, 15),
        statusRaw: 'Baixado',
        statusNormalized: 'WON',
        channel: 'SHOWROOM',
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        davId: BigInt(2002),
        sequentialLinkedSale: BigInt(3003),
        payloadJson: { source: 'fixture' },
      },
    })

    expect(upsertArgs.create.valueAmount.toString()).toBe('1200.50')
    expect(upsertArgs.update.valueAmount.toString()).toBe('1200.50')
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
})
