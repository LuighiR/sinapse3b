import { BadRequestException } from '@nestjs/common'
import { FlwMessagingSyncService } from './flw-messaging-sync.service'

const originalEnv = process.env

describe('FlwMessagingSyncService', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/sinapse',
      AUTH_JWT_SECRET: 'super-secret',
      AUTH_JWT_ISSUER: 'sinapse3',
      AUTH_JWT_AUDIENCE: 'sinapse3-web',
      FLW_CHAT_API_TOKEN: 'token-123',
      FLW_CHAT_API_BASE_URL: 'https://api.wts.chat/chat',
      INTERNAL_JOB_KEY: 'test-internal-job-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('syncs sessions and messages into raw only', async () => {
    const listSessions = jest
      .fn()
      .mockResolvedValueOnce({
        pageNumber: 1,
        pageSize: 100,
        items: [
          {
            id: 'session-1',
            startAt: '2026-06-01T10:00:00.000Z',
            endAt: null,
            contactId: 'contact-1',
            userId: 'agent-1',
            agentDetails: { email: 'maria@empresa.com' },
            status: 'IN_PROGRESS',
            departmentId: 'dept-1',
          },
        ],
        totalItems: 1,
        totalPages: 1,
        hasMorePages: false,
      })

    const listSessionMessages = jest.fn().mockResolvedValue({
      pageNumber: 1,
      pageSize: 100,
      items: [
        {
          id: 'message-1',
          sessionId: 'session-1',
          direction: 'TO_HUB',
          origin: 'DEFAULT',
          type: 'TEXT',
          text: 'Olá',
          userId: null,
          createdAt: '2026-06-01T10:01:00.000Z',
          updatedAt: '2026-06-01T10:01:00.000Z',
          details: null,
        },
      ],
      totalItems: 1,
      totalPages: 1,
      hasMorePages: false,
    })

    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('/v2/session?')) {
        return new Response(JSON.stringify(await listSessions()), { status: 200 })
      }

      if (url.includes('/v1/session/session-1/message')) {
        return new Response(JSON.stringify(await listSessionMessages()), { status: 200 })
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })

    const rawRepository = {
      upsertSession: jest.fn().mockResolvedValue(undefined),
      upsertMessage: jest.fn().mockResolvedValue(undefined),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        provider: 'FLW',
        lastSessionSyncAt: null,
        lastMessageSyncAt: null,
        lastSuccessAt: null,
        lastError: null,
      }),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }
    const service = new FlwMessagingSyncService(
      rawRepository as never,
      canonicalRepository as never,
    )

    const result = await service.syncClient('ferracosul')

    expect(result).toEqual({
      clientId: 'ferracosul',
      sessionsFetched: 1,
      messagesFetched: 1,
      lastSessionSyncAt: '2026-06-01T10:00:00.000Z',
      lastMessageSyncAt: '2026-06-01T10:01:00.000Z',
    })
    expect(rawRepository.upsertSession).toHaveBeenCalledTimes(1)
    expect(rawRepository.upsertMessage).toHaveBeenCalledTimes(1)
    expect(canonicalRepository.updateSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ferracosul',
        lastError: null,
      }),
    )
  })

  it('rejects sync when FLW token is missing', async () => {
    process.env.FLW_CHAT_API_TOKEN = ''

    const service = new FlwMessagingSyncService({} as never, {} as never)

    await expect(service.syncClient('ferracosul')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('persists sync errors without updating success timestamp', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))

    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        provider: 'FLW',
        lastSessionSyncAt: null,
        lastMessageSyncAt: null,
        lastSuccessAt: null,
        lastError: null,
      }),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new FlwMessagingSyncService(
      { upsertSession: jest.fn(), upsertMessage: jest.fn() } as never,
      canonicalRepository as never,
    )

    await expect(service.syncClient('ferracosul')).rejects.toThrow('network down')
    expect(canonicalRepository.updateSyncState).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      lastError: 'network down',
    })
  })
})
