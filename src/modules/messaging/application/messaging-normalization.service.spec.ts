import { MessagingNormalizationService } from './messaging-normalization.service'

describe('MessagingNormalizationService', () => {
  it('normalizes incremental raw FLW data using the last normalized watermark', async () => {
    const since = new Date('2026-06-01T09:00:00.000Z')
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([
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
      ]),
      listSessionsByClientIdSince: jest.fn().mockResolvedValue([
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
      ]),
      listMessagesByClientIdSince: jest.fn().mockResolvedValue([
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
      ]),
    }
    const contactService = {
      upsertSessionWithContact: jest.fn().mockResolvedValue(undefined),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        lastNormalizedAt: since,
      }),
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map([['dept-1', 2]])),
      upsertMessage: jest.fn().mockResolvedValue(undefined),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
      contactService as never,
    )

    const result = await service.normalizeClient({ clientId: 'ferracosul' })

    expect(result.mode).toBe('incremental')
    expect(result.since).toBe(since.toISOString())
    expect(result.sessionsWritten).toBe(1)
    expect(result.messagesWritten).toBe(1)
    expect(rawRepository.listSessionsByClientIdSince).toHaveBeenCalledWith('ferracosul', since)
    expect(rawRepository.listMessagesByClientIdSince).toHaveBeenCalledWith('ferracosul', since)
    expect(canonicalRepository.updateSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ferracosul',
        lastError: null,
      }),
    )
  })

  it('skips messages when the session was not normalized', async () => {
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([]),
      listSessionsByClientIdSince: jest.fn().mockResolvedValue([]),
      listMessagesByClientId: jest.fn().mockResolvedValue([
        {
          id: 'message-1',
          sessionId: 'missing-session',
          direction: 'TO_HUB',
          origin: 'DEFAULT',
          type: 'TEXT',
          text: 'Olá',
          userId: null,
          createdAt: '2026-06-01T10:01:00.000Z',
          updatedAt: '2026-06-01T10:01:00.000Z',
          details: null,
        },
      ]),
    }
    const contactService = {
      upsertSessionWithContact: jest.fn(),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        lastNormalizedAt: null,
      }),
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      upsertMessage: jest.fn(),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
      contactService as never,
    )

    const result = await service.normalizeClient({ clientId: 'ferracosul', full: true })

    expect(result.mode).toBe('full')
    expect(result.messagesWritten).toBe(0)
    expect(result.messagesSkippedMissingSession).toBe(1)
    expect(canonicalRepository.upsertMessage).not.toHaveBeenCalled()
  })
})
