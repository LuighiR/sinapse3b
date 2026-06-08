import { Test } from '@nestjs/testing'
import {
  CALL_FACT_UPSERT_REPOSITORY,
  CallNormalizationService,
  PrismaCallFactUpsertRepository,
  PrismaRawFerracoCallReader,
  RAW_FERRACO_CALL_READER,
  type CallFactUpsertRepository,
  type RawFerracoCallReader,
} from './call-normalization.service'

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim()

const taggedSqlParts = (strings: TemplateStringsArray): string => normalizeSql(strings.join('$PARAM'))

const taggedSql = (mock: jest.Mock): string => {
  const [strings] = mock.mock.calls[0] as [TemplateStringsArray, ...unknown[]]

  return taggedSqlParts(strings)
}

describe('CallNormalizationService', () => {
  it('uses the bulk upsert path when the repository supports it', async () => {
    const rawReader: RawFerracoCallReader = {
      countByClientId: jest.fn().mockResolvedValue(3),
      findByClientId: jest.fn().mockResolvedValue([]),
    }

    const callFactRepository: CallFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      bulkUpsertClient: jest.fn().mockResolvedValue(undefined),
    }

    const service = new CallNormalizationService(rawReader, callFactRepository)

    await expect(service.normalizeClientCalls('client-1')).resolves.toEqual({
      recordsRead: 3,
      recordsWritten: 3,
    })
    expect(rawReader.countByClientId).toHaveBeenCalledWith('client-1')
    expect(callFactRepository.bulkUpsertClient).toHaveBeenCalledWith('client-1')
    expect(rawReader.findByClientId).not.toHaveBeenCalled()
    expect(callFactRepository.upsert).not.toHaveBeenCalled()
  })

  it('normalizes all branch telephony domains for the requested client and writes branch ids', async () => {
    const rawReader: RawFerracoCallReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 101,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-branch-a',
          xmlCdrUuid: 'cdr-101',
          extensionUuid: 'ext-101',
          direction: 'inbound',
          callerNumber: '5551999999999',
          destinationNumber: '101',
          dateStart: '2026-01-10T09:15:00.000Z',
          dateFinal: '2026-01-10T09:20:00.000Z',
          duration: '300',
          recordPath: null,
          recordName: null,
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'send_bye',
          payload: { domain: 'a' },
        },
        {
          id: 102,
          clientId: 'client-1',
          branchId: 12,
          domainUuid: 'domain-branch-b',
          xmlCdrUuid: 'cdr-102',
          extensionUuid: 'ext-102',
          direction: 'outbound',
          callerNumber: '102',
          destinationNumber: '5551988887777',
          dateStart: '2026-01-10T10:15:00.000Z',
          dateFinal: '2026-01-10T10:20:00.000Z',
          duration: '300',
          recordPath: null,
          recordName: null,
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'recv_bye',
          payload: { domain: 'b' },
        },
      ]),
    }

    const callFactRepository: CallFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new CallNormalizationService(rawReader, callFactRepository)

    const result = await service.normalizeClientCalls('client-1')

    expect(rawReader.findByClientId).toHaveBeenCalledWith('client-1')
    expect(result).toEqual({ recordsRead: 2, recordsWritten: 2 })

    const writtenRows = (callFactRepository.upsert as jest.Mock).mock.calls.map(([args]) => args.create)

    expect(writtenRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branchId: 11,
          domainUuid: 'domain-branch-a',
          sourceRecordId: 101,
        }),
        expect.objectContaining({
          branchId: 12,
          domainUuid: 'domain-branch-b',
          sourceRecordId: 102,
        }),
      ]),
    )
  })

  it('marks inbound extension calls as received when extension_uuid exists', async () => {
    const rawReader: RawFerracoCallReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 1,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-1',
          extensionUuid: 'ext-1',
          direction: 'inbound',
          callerNumber: '5551999999999',
          destinationNumber: '104',
          dateStart: '2026-01-10T09:15:00.000Z',
          dateFinal: '2026-01-10T09:20:00.000Z',
          duration: '300',
          recordPath: '/records/2026/01/10',
          recordName: 'cdr-1.mp3',
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'send_bye',
          payload: { source: 'fixture' },
        },
      ]),
    }

    const callFactRepository: CallFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new CallNormalizationService(rawReader, callFactRepository)

    const result = await service.normalizeClientCalls('client-1')

    expect(rawReader.findByClientId).toHaveBeenCalledWith('client-1')
    expect(result).toEqual({ recordsRead: 1, recordsWritten: 1 })
    expect(callFactRepository.upsert).toHaveBeenCalledTimes(1)

    const [upsertArgs] = (callFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs).toMatchObject({
      where: {
        clientId_sourceTable_sourceRecordId: {
          clientId: 'client-1',
          sourceTable: 'raw.ferraco_calls',
          sourceRecordId: 1,
        },
      },
      create: {
        clientId: 'client-1',
        sourceTable: 'raw.ferraco_calls',
        sourceRecordId: 1,
        branchId: 11,
        domainUuid: 'domain-1',
        xmlCdrUuid: 'cdr-1',
        direction: 'inbound',
        callerNumber: '5551999999999',
        destinationNumber: '104',
        extensionUuid: 'ext-1',
        startedAt: new Date('2026-01-10T09:15:00.000Z'),
        endedAt: new Date('2026-01-10T09:20:00.000Z'),
        recordPath: '/records/2026/01/10',
        recordName: 'cdr-1.mp3',
        hangupCause: 'NORMAL_CLEARING',
        sipHangupDisposition: 'send_bye',
        isInboundToCompany: true,
        isLost: false,
        isReceived: true,
        agentResolutionType: 'EXTENSION_UUID',
        agentResolutionKey: 'ext-1',
        agentExtensionNumber: '104',
        payloadJson: { source: 'fixture' },
      },
    })

    expect(upsertArgs.create.durationSeconds.toString()).toBe('300')
    expect(upsertArgs.update.durationSeconds.toString()).toBe('300')
  })

  it('marks recv_cancel inbound calls as lost and falls back to destination number', async () => {
    const rawReader: RawFerracoCallReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 2,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-2',
          extensionUuid: null,
          direction: 'inbound',
          callerNumber: '5551988887777',
          destinationNumber: '107',
          dateStart: '2026-01-10T10:00:00.000Z',
          dateFinal: '1970-01-01T00:00:00.000Z',
          duration: '0',
          recordPath: null,
          recordName: null,
          hangupCause: 'ORIGINATOR_CANCEL',
          sipHangupDisposition: 'recv_cancel',
          payload: null,
        },
      ]),
    }

    const callFactRepository: CallFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new CallNormalizationService(rawReader, callFactRepository)

    await service.normalizeClientCalls('client-1')

    const [upsertArgs] = (callFactRepository.upsert as jest.Mock).mock.calls[0]

    expect(upsertArgs.create).toMatchObject({
      isInboundToCompany: true,
      isLost: true,
      isReceived: false,
      agentResolutionType: 'EXTENSION_NUMBER',
      agentResolutionKey: '107',
      agentExtensionNumber: '107',
      extensionUuid: null,
      sipHangupDisposition: 'recv_cancel',
      hangupCause: 'ORIGINATOR_CANCEL',
      payloadJson: {},
    })
  })

  it.each([
    ['send_cancel', 'NO_ANSWER'],
    ['send_refuse', 'NORMAL_CLEARING'],
  ])(
    'marks %s inbound calls as lost when extension_uuid exists',
    async (sipHangupDisposition, hangupCause) => {
      const rawReader: RawFerracoCallReader = {
        findByClientId: jest.fn().mockResolvedValue([
          {
            id: 20,
            clientId: 'client-1',
            branchId: 11,
            domainUuid: 'domain-1',
            xmlCdrUuid: 'cdr-20',
            extensionUuid: 'ext-20',
            direction: 'inbound',
            callerNumber: '5551988887777',
            destinationNumber: '109',
            dateStart: '2026-01-10T10:30:00.000Z',
            dateFinal: '2026-01-10T10:30:05.000Z',
            duration: '5',
            recordPath: null,
            recordName: null,
            hangupCause,
            sipHangupDisposition,
            payload: null,
          },
        ]),
      }

      const callFactRepository: CallFactUpsertRepository = {
        upsert: jest.fn().mockResolvedValue(undefined),
      }

      const service = new CallNormalizationService(rawReader, callFactRepository)

      await service.normalizeClientCalls('client-1')

      const [upsertArgs] = (callFactRepository.upsert as jest.Mock).mock.calls[0]

      expect(upsertArgs.create).toMatchObject({
        isInboundToCompany: true,
        isLost: true,
        isReceived: false,
        extensionUuid: 'ext-20',
        agentResolutionType: 'EXTENSION_UUID',
        agentResolutionKey: 'ext-20',
        agentExtensionNumber: '109',
        sipHangupDisposition,
        hangupCause,
      })
    },
  )

  it('marks outbound, local, long-destination, and internal-caller rows as outside the inbound company slice', async () => {
    const rawReader: RawFerracoCallReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 3,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-3',
          extensionUuid: 'ext-3',
          direction: 'outbound',
          callerNumber: '104',
          destinationNumber: '5551988887777',
          dateStart: '2026-01-10T11:00:00.000Z',
          dateFinal: '2026-01-10T11:03:00.000Z',
          duration: '180',
          recordPath: null,
          recordName: null,
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'recv_bye',
          payload: null,
        },
        {
          id: 4,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-4',
          extensionUuid: null,
          direction: 'local',
          callerNumber: '105',
          destinationNumber: '106',
          dateStart: '2026-01-10T11:10:00.000Z',
          dateFinal: '2026-01-10T11:12:00.000Z',
          duration: '120',
          recordPath: null,
          recordName: null,
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'send_bye',
          payload: null,
        },
        {
          id: 5,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-5',
          extensionUuid: null,
          direction: 'inbound',
          callerNumber: '5551988887777',
          destinationNumber: '997444',
          dateStart: '2026-01-10T11:20:00.000Z',
          dateFinal: '2026-01-10T11:20:10.000Z',
          duration: '10',
          recordPath: null,
          recordName: null,
          hangupCause: 'ORIGINATOR_CANCEL',
          sipHangupDisposition: 'recv_cancel',
          payload: null,
        },
        {
          id: 6,
          clientId: 'client-1',
          branchId: 11,
          domainUuid: 'domain-1',
          xmlCdrUuid: 'cdr-6',
          extensionUuid: 'ext-6',
          direction: 'inbound',
          callerNumber: '104',
          destinationNumber: '107',
          dateStart: '2026-01-10T11:30:00.000Z',
          dateFinal: '2026-01-10T11:31:00.000Z',
          duration: '60',
          recordPath: null,
          recordName: null,
          hangupCause: 'NORMAL_CLEARING',
          sipHangupDisposition: 'send_bye',
          payload: null,
        },
      ]),
    }

    const callFactRepository: CallFactUpsertRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    }

    const service = new CallNormalizationService(rawReader, callFactRepository)

    await service.normalizeClientCalls('client-1')

    const writtenRows = (callFactRepository.upsert as jest.Mock).mock.calls.map(([args]) => args.create)

    expect(writtenRows).toHaveLength(4)

    for (const row of writtenRows) {
      expect(row.isInboundToCompany).toBe(false)
      expect(row.isLost).toBe(false)
      expect(row.isReceived).toBe(false)
    }
  })

  it('fails fast when Nest dependencies are not wired', async () => {
    await expect(
      Test.createTestingModule({
        providers: [CallNormalizationService],
      }).compile(),
    ).rejects.toThrow()
  })

  it('resolves cleanly when explicit reader and repository providers are wired', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CallNormalizationService,
        {
          provide: RAW_FERRACO_CALL_READER,
          useValue: {
            findByClientId: jest.fn().mockResolvedValue([]),
          } satisfies RawFerracoCallReader,
        },
        {
          provide: CALL_FACT_UPSERT_REPOSITORY,
          useValue: {
            upsert: jest.fn().mockResolvedValue(undefined),
          } satisfies CallFactUpsertRepository,
        },
      ],
    }).compile()

    expect(moduleRef.get(CallNormalizationService)).toBeInstanceOf(CallNormalizationService)
  })
})

describe('PrismaRawFerracoCallReader', () => {
  it('counts calls through branch telephony domains for the requested client', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ count: '2' }]),
    } as unknown as ConstructorParameters<typeof PrismaRawFerracoCallReader>[0]
    const reader = new PrismaRawFerracoCallReader(prisma)

    await expect(reader.countByClientId('client-1')).resolves.toBe(2)

    const sql = taggedSql(prisma.$queryRaw as jest.Mock)

    expect(sql).toContain(
      'FROM raw.ferraco_calls AS call INNER JOIN core.branches AS branch ON branch.telephony_domain_uuid = call.domain_uuid INNER JOIN core.sinapse_clients AS client ON client.id = branch.client_id WHERE client.id =',
    )
    expect(sql).not.toContain('client.domain_uuid = call.domain_uuid')
  })

  it('returns only calls from branch domains that belong to the requested client', async () => {
    const branches = [
      { id: 11, clientId: 'client-1', telephonyDomainUuid: 'domain-branch-a' },
      { id: 12, clientId: 'client-1', telephonyDomainUuid: 'domain-branch-b' },
      { id: 21, clientId: 'client-2', telephonyDomainUuid: 'domain-other-client' },
    ]
    const clients = [
      { id: 'client-1', legacyDomainUuid: 'domain-unmapped' },
      { id: 'client-2', legacyDomainUuid: 'domain-other-client' },
    ]
    const rawCalls = [
      { id: 101, domainUuid: 'domain-branch-a', xmlCdrUuid: 'cdr-101' },
      { id: 102, domainUuid: 'domain-branch-b', xmlCdrUuid: 'cdr-102' },
      { id: 103, domainUuid: 'domain-unmapped', xmlCdrUuid: 'cdr-103' },
      { id: 104, domainUuid: 'domain-other-client', xmlCdrUuid: 'cdr-104' },
    ]

    const prisma = {
      $queryRaw: jest.fn((strings: TemplateStringsArray, clientId: string) => {
        const sql = taggedSqlParts(strings)

        if (sql.includes('client.domain_uuid = call.domain_uuid')) {
          const client = clients.find((candidate) => candidate.id === clientId)

          return Promise.resolve(
            rawCalls
              .filter((call) => call.domainUuid === client?.legacyDomainUuid)
              .map((call) => ({
                id: call.id,
                clientId,
                branchId: null,
                domainUuid: call.domainUuid,
                xmlCdrUuid: call.xmlCdrUuid,
                extensionUuid: null,
                direction: 'inbound',
                callerNumber: '5551999999999',
                destinationNumber: '101',
                dateStart: '2026-01-10T09:15:00.000Z',
                dateFinal: null,
                duration: '0',
                recordPath: null,
                recordName: null,
                hangupCause: null,
                sipHangupDisposition: null,
                payload: {},
              })),
          )
        }

        return Promise.resolve(
          rawCalls.flatMap((call) => {
            const branch = branches.find((candidate) => candidate.telephonyDomainUuid === call.domainUuid)

            if (!branch || branch.clientId !== clientId) {
              return []
            }

            return [
              {
                id: call.id,
                clientId,
                branchId: branch.id,
                domainUuid: call.domainUuid,
                xmlCdrUuid: call.xmlCdrUuid,
                extensionUuid: null,
                direction: 'inbound',
                callerNumber: '5551999999999',
                destinationNumber: '101',
                dateStart: '2026-01-10T09:15:00.000Z',
                dateFinal: null,
                duration: '0',
                recordPath: null,
                recordName: null,
                hangupCause: null,
                sipHangupDisposition: null,
                payload: {},
              },
            ]
          }),
        )
      }),
    } as unknown as ConstructorParameters<typeof PrismaRawFerracoCallReader>[0]
    const reader = new PrismaRawFerracoCallReader(prisma)

    const calls = await reader.findByClientId('client-1')

    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.domainUuid)).toEqual(['domain-branch-a', 'domain-branch-b'])
    expect(calls.map((call) => call.branchId)).toEqual([11, 12])
  })

  it('selects branch ids and filters out unmapped or other-client domains through branch joins', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as ConstructorParameters<typeof PrismaRawFerracoCallReader>[0]
    const reader = new PrismaRawFerracoCallReader(prisma)

    await reader.findByClientId('client-1')

    const sql = taggedSql(prisma.$queryRaw as jest.Mock)

    expect(sql).toContain('branch.id AS "branchId"')
    expect(sql).toContain(
      'FROM raw.ferraco_calls AS call INNER JOIN core.branches AS branch ON branch.telephony_domain_uuid = call.domain_uuid INNER JOIN core.sinapse_clients AS client ON client.id = branch.client_id WHERE client.id =',
    )
    expect(sql).not.toContain('client.domain_uuid = call.domain_uuid')
  })
})

describe('PrismaCallFactUpsertRepository', () => {
  it('bulk upserts branch ids while keeping the original raw domain uuid', async () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(2),
    } as unknown as ConstructorParameters<typeof PrismaCallFactUpsertRepository>[0]
    const repository = new PrismaCallFactUpsertRepository(prisma)

    await repository.bulkUpsertClient('client-1')

    const executeRawUnsafe = prisma.$executeRawUnsafe as jest.Mock
    const sql = normalizeSql(executeRawUnsafe.mock.calls[0][0])

    expect(executeRawUnsafe).toHaveBeenCalledWith(expect.any(String), 'client-1')
    expect(sql).toContain('INSERT INTO core.call_facts ( client_id, branch_id, source_table')
    expect(sql).toContain("SELECT client.id, branch.id, 'raw.ferraco_calls', call.id, call.domain_uuid")
    expect(sql).toContain(
      'FROM raw.ferraco_calls AS call INNER JOIN core.branches AS branch ON branch.telephony_domain_uuid = call.domain_uuid INNER JOIN core.sinapse_clients AS client ON client.id = branch.client_id WHERE client.id = $1',
    )
    expect(sql).toContain('branch_id = EXCLUDED.branch_id')
    expect(sql).not.toContain('client.domain_uuid = call.domain_uuid')
  })
})
