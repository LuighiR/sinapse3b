import { KpiPeriod } from '../../kpi/domain/kpi-period'
import { DkwMessagingMigrationService } from './dkw-messaging-migration.service'

const january = KpiPeriod.between({ from: '2026-01-01', to: '2026-01-31' })
const february = KpiPeriod.between({ from: '2026-02-01', to: '2026-02-28' })

describe('DkwMessagingMigrationService', () => {
  const legacySession = {
    id: 'session-legacy-1',
    ticketId: 'ticket-1',
    externalTrackingId: 12345,
    startedAt: new Date('2026-01-10T08:00:00.000Z'),
    endedAt: null,
    assignedUserName: 'Maria',
    assignedUserEmail: 'maria@empresa.com',
    ticket: {
      id: 'ticket-1',
      status: 'OPEN',
      contactExternalId: 999,
      contactNumber: '5511999999999',
    },
  }

  const legacyMessage = {
    id: 'message-legacy-1',
    ticketId: 'ticket-1',
    sessionId: 'session-legacy-1',
    externalMessageId: 'ext-msg-1',
    body: 'Olá',
    fromMe: false,
    mediaUrl: null,
    mediaType: null,
    createdAtExternal: new Date('2026-01-10T08:05:00.000Z'),
    updatedAtExternal: new Date('2026-01-10T08:05:00.000Z'),
    senderType: 'HUMAN' as const,
    rawJson: null,
  }

  function buildRepository(overrides: Partial<Record<string, jest.Mock>> = {}) {
    return {
      listSessionsStartedInPeriod: jest.fn().mockResolvedValue([legacySession]),
      listSessionsByIds: jest.fn().mockResolvedValue([]),
      countMessagesInPeriod: jest.fn().mockResolvedValue(1),
      listMessagesInPeriodBatch: jest
        .fn()
        .mockResolvedValue({ items: [legacyMessage], nextCursor: null }),
      ...overrides,
    }
  }

  it('iterates month by month inside the requested range', async () => {
    const legacyRepository = buildRepository({
      listSessionsStartedInPeriod: jest
        .fn()
        .mockResolvedValueOnce([legacySession])
        .mockResolvedValueOnce([]),
      countMessagesInPeriod: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      listMessagesInPeriodBatch: jest
        .fn()
        .mockResolvedValueOnce({ items: [legacyMessage], nextCursor: null })
        .mockResolvedValueOnce({ items: [], nextCursor: null }),
    })

    const upsertMessage = jest.fn().mockResolvedValue(undefined)
    const service = new DkwMessagingMigrationService(
      legacyRepository as never,
      {
        upsertSession: jest.fn().mockResolvedValue(undefined),
        upsertMessage,
      } as never,
    )

    const result = await service.migrateClient({
      clientId: 'ferracosul',
      period: KpiPeriod.between({ from: '2026-01-01', to: '2026-02-28' }),
      batchSize: 2000,
    })

    expect(result.windowsProcessed).toBe(2)
    expect(result.windows).toHaveLength(2)
    expect(result.totals.messagesWritten).toBe(1)
    expect(legacyRepository.countMessagesInPeriod).toHaveBeenCalledTimes(2)
    expect(upsertMessage).toHaveBeenCalledTimes(1)
  })

  it('loads parent sessions on demand when messages reference sessions outside the month', async () => {
    const legacyRepository = buildRepository({
      listSessionsStartedInPeriod: jest.fn().mockResolvedValue([]),
      listSessionsByIds: jest.fn().mockResolvedValue([legacySession]),
    })

    const upsertSession = jest.fn().mockResolvedValue(undefined)
    const service = new DkwMessagingMigrationService(
      legacyRepository as never,
      {
        upsertSession,
        upsertMessage: jest.fn().mockResolvedValue(undefined),
      } as never,
    )

    const result = await service.migrateClient({
      clientId: 'ferracosul',
      period: january,
      batchSize: 2000,
    })

    expect(result.windows[0]?.sessionsWritten).toBe(1)
    expect(legacyRepository.listSessionsByIds).toHaveBeenCalledWith('ferracosul', ['session-legacy-1'])
  })

  it('processes multiple message batches by cursor within a month', async () => {
    const legacyRepository = buildRepository({
      listMessagesInPeriodBatch: jest
        .fn()
        .mockResolvedValueOnce({ items: [legacyMessage], nextCursor: 'message-legacy-1' })
        .mockResolvedValueOnce({
          items: [{ ...legacyMessage, id: 'message-legacy-2', externalMessageId: 'ext-msg-2' }],
          nextCursor: null,
        }),
      countMessagesInPeriod: jest.fn().mockResolvedValue(2),
    })

    const upsertMessage = jest.fn().mockResolvedValue(undefined)
    const service = new DkwMessagingMigrationService(
      legacyRepository as never,
      {
        upsertSession: jest.fn().mockResolvedValue(undefined),
        upsertMessage,
      } as never,
    )

    const result = await service.migrateClient({
      clientId: 'ferracosul',
      period: january,
      batchSize: 1,
    })

    expect(result.totals.messagesWritten).toBe(2)
    expect(result.totals.batchesProcessed).toBe(2)
  })

  it('skips messages whose session cannot be resolved', async () => {
    const legacyRepository = buildRepository({
      listSessionsStartedInPeriod: jest.fn().mockResolvedValue([]),
      listSessionsByIds: jest.fn().mockResolvedValue([]),
    })

    const upsertMessage = jest.fn()
    const service = new DkwMessagingMigrationService(
      legacyRepository as never,
      {
        upsertSession: jest.fn(),
        upsertMessage,
      } as never,
    )

    const result = await service.migrateClient({
      clientId: 'ferracosul',
      period: january,
      batchSize: 2000,
    })

    expect(result.totals.messagesWritten).toBe(0)
    expect(result.totals.messagesSkippedMissingSession).toBe(1)
    expect(upsertMessage).not.toHaveBeenCalled()
  })
})
