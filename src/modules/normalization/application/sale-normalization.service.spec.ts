import { Test } from '@nestjs/testing'
import {
  RAW_FERRACO_SALE_READER,
  SALE_FACT_UPSERT_REPOSITORY,
  SaleNormalizationService,
  type RawFerracoSaleReader,
  type SaleFactUpsertRepository,
} from './sale-normalization.service'
import { mapSaleStatus } from './sale-status.mapper'

describe('mapSaleStatus', () => {
  it.each([
    ['N', 'VALID'],
    ['S', 'CANCELED'],
    [null, 'UNKNOWN'],
  ])('maps %p to %p', (rawStatus, expected) => {
    expect(mapSaleStatus(rawStatus)).toBe(expected)
  })
})

describe('SaleNormalizationService', () => {
  it('normalizes raw ferraco sales for the provided client and enriches channel from linked budgets', async () => {
    const rawReader: RawFerracoSaleReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 42,
          clientId: 'client-1',
          branch: '5',
          sellerId: 7,
          sellerName: 'Maria',
          saleDate: '2026-01-10',
          saleTime: '08:15:00',
          canceled: 'N',
          customerName: 'Cliente Teste',
          cpfCnpj: '12345678900',
          value: '1200.50',
          sequential: '1001',
          invoiceSerie: '3',
          invoiceNumeric: '2002',
          listDavsId: '"5001"',
          channel: 'Pedido Televendas',
          hasLinkedBudget: true,
          linkedBudgetSourceRecordId: 99,
          payload: { source: 'fixture' },
        },
      ]),
    }

    const saleFactRepository: SaleFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new SaleNormalizationService(rawReader, saleFactRepository)

    const result = await service.normalizeClientSales('client-1')

    expect(rawReader.findByClientId).toHaveBeenCalledWith('client-1')
    expect(result).toEqual({ recordsRead: 1, recordsWritten: 1 })
    expect(saleFactRepository.upsert).toHaveBeenCalledTimes(1)

    const [upsertArgs] = (saleFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs).toMatchObject({
      where: {
        clientId_sourceTable_sourceRecordId: {
          clientId: 'client-1',
          sourceTable: 'raw.ferraco_sales',
          sourceRecordId: 42,
        },
      },
      create: {
        clientId: 'client-1',
        sourceTable: 'raw.ferraco_sales',
        sourceRecordId: 42,
        branchId: null,
        branchName: '5',
        sellerId: 7,
        sellerName: 'Maria',
        saleDate: new Date(2026, 0, 10),
        saleDatetime: new Date(2026, 0, 10, 8, 15, 0),
        statusRaw: 'N',
        statusNormalized: 'VALID',
        channel: 'Pedido Televendas',
        hasLinkedBudget: true,
        linkedBudgetSourceRecordId: 99,
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        invoiceSerie: BigInt(3),
        invoiceNumeric: BigInt(2002),
        listDavsId: '"5001"',
        payloadJson: { source: 'fixture' },
      },
      update: {
        branchId: null,
        branchName: '5',
        sellerId: 7,
        sellerName: 'Maria',
        saleDate: new Date(2026, 0, 10),
        saleDatetime: new Date(2026, 0, 10, 8, 15, 0),
        statusRaw: 'N',
        statusNormalized: 'VALID',
        channel: 'Pedido Televendas',
        hasLinkedBudget: true,
        linkedBudgetSourceRecordId: 99,
        customerName: 'Cliente Teste',
        cpfCnpj: '12345678900',
        sequential: BigInt(1001),
        invoiceSerie: BigInt(3),
        invoiceNumeric: BigInt(2002),
        listDavsId: '"5001"',
        payloadJson: { source: 'fixture' },
      },
    })

    expect(upsertArgs.create.valueAmount.toString()).toBe('1200.50')
    expect(upsertArgs.update.valueAmount.toString()).toBe('1200.50')
  })

  it('normalizes missing optional sales fields into safe canonical defaults', async () => {
    const rawReader: RawFerracoSaleReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 77,
          clientId: 'client-1',
          branch: '5',
          sellerId: null,
          sellerName: null,
          saleDate: '2026-01-11',
          saleTime: null,
          canceled: null,
          customerName: null,
          cpfCnpj: null,
          value: null,
          sequential: null,
          invoiceSerie: null,
          invoiceNumeric: null,
          listDavsId: null,
          channel: null,
          hasLinkedBudget: false,
          linkedBudgetSourceRecordId: null,
          payload: null,
        },
      ]),
    }

    const saleFactRepository: SaleFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new SaleNormalizationService(rawReader, saleFactRepository)

    await service.normalizeClientSales('client-1')

    const [upsertArgs] = (saleFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs.create).toMatchObject({
      sellerId: 0,
      sellerName: '',
      customerName: '',
      statusNormalized: 'UNKNOWN',
      hasLinkedBudget: false,
      linkedBudgetSourceRecordId: null,
    })
    expect(upsertArgs.create.valueAmount.toString()).toBe('0')
  })

  it('fails fast when Nest dependencies are not wired', async () => {
    await expect(
      Test.createTestingModule({
        providers: [SaleNormalizationService],
      }).compile(),
    ).rejects.toThrow()
  })

  it('resolves cleanly when explicit reader and repository providers are wired', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SaleNormalizationService,
        {
          provide: RAW_FERRACO_SALE_READER,
          useValue: {
            findByClientId: jest.fn().mockResolvedValue([]),
          } satisfies RawFerracoSaleReader,
        },
        {
          provide: SALE_FACT_UPSERT_REPOSITORY,
          useValue: {
            upsert: jest.fn().mockResolvedValue(undefined),
          } satisfies SaleFactUpsertRepository,
        },
      ],
    }).compile()

    expect(moduleRef.get(SaleNormalizationService)).toBeInstanceOf(SaleNormalizationService)
  })
})
