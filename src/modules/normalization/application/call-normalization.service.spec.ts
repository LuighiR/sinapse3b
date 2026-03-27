import { Test } from '@nestjs/testing'
import {
  CALL_FACT_UPSERT_REPOSITORY,
  CallNormalizationService,
  RAW_FERRACO_CALL_READER,
  type CallFactUpsertRepository,
  type RawFerracoCallReader,
} from './call-normalization.service'

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

  it('marks inbound extension calls as received when extension_uuid exists', async () => {
    const rawReader: RawFerracoCallReader = {
      findByClientId: jest.fn().mockResolvedValue([
        {
          id: 1,
          clientId: 'client-1',
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
