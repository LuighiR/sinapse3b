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
      loadWhatsAppCityIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      resolveWhatsAppCityForDepartment: jest.fn().mockResolvedValue(null),
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
      loadWhatsAppCityIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      resolveWhatsAppCityForDepartment: jest.fn().mockResolvedValue(null),
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

  it('passes mapped whatsappCityId to upsert when department is in city map', async () => {
    const session = {
      id: 'session-1',
      startAt: '2026-06-01T10:00:00.000Z',
      endAt: null,
      contactId: 'contact-1',
      userId: 'agent-1',
      agentDetails: { email: 'maria@empresa.com' },
      status: 'IN_PROGRESS',
      departmentId: 'dept-1',
    }
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([session]),
      listSessionsByClientIdSince: jest.fn().mockResolvedValue([session]),
      listMessagesByClientIdSince: jest.fn().mockResolvedValue([]),
    }
    const contactService = {
      upsertSessionWithContact: jest.fn().mockResolvedValue(undefined),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        lastNormalizedAt: new Date('2026-06-01T09:00:00.000Z'),
      }),
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      loadWhatsAppCityIdByDepartmentId: jest
        .fn()
        .mockResolvedValue(new Map([['dept-1', 'city-uuid']])),
      resolveWhatsAppCityForDepartment: jest.fn().mockResolvedValue(null),
      upsertMessage: jest.fn(),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
      contactService as never,
    )

    await service.normalizeClient({ clientId: 'ferracosul' })

    expect(canonicalRepository.loadWhatsAppCityIdByDepartmentId).toHaveBeenCalledWith('ferracosul')
    expect(canonicalRepository.resolveWhatsAppCityForDepartment).not.toHaveBeenCalled()
    expect(contactService.upsertSessionWithContact).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappCityId: 'city-uuid',
        externalDepartmentId: 'dept-1',
      }),
    )
  })

  it('resolves unknown department as PENDING and upserts with null city', async () => {
    const session = {
      id: 'session-1',
      startAt: '2026-06-01T10:00:00.000Z',
      endAt: null,
      contactId: 'contact-1',
      userId: 'agent-1',
      agentDetails: { email: 'maria@empresa.com' },
      status: 'IN_PROGRESS',
      departmentId: 'unknown-dept',
    }
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([session]),
      listSessionsByClientIdSince: jest.fn().mockResolvedValue([session]),
      listMessagesByClientIdSince: jest.fn().mockResolvedValue([]),
    }
    const contactService = {
      upsertSessionWithContact: jest.fn().mockResolvedValue(undefined),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        lastNormalizedAt: new Date('2026-06-01T09:00:00.000Z'),
      }),
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      loadWhatsAppCityIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      resolveWhatsAppCityForDepartment: jest.fn().mockResolvedValue(null),
      upsertMessage: jest.fn(),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
      contactService as never,
    )

    await service.normalizeClient({ clientId: 'ferracosul' })

    expect(canonicalRepository.resolveWhatsAppCityForDepartment).toHaveBeenCalledWith({
      clientId: 'ferracosul',
      departmentId: 'unknown-dept',
    })
    expect(contactService.upsertSessionWithContact).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappCityId: null,
        externalDepartmentId: 'unknown-dept',
      }),
    )
  })

  it('does not resolve city when session has no departmentId', async () => {
    const session = {
      id: 'session-1',
      startAt: '2026-06-01T10:00:00.000Z',
      endAt: null,
      contactId: 'contact-1',
      userId: 'agent-1',
      agentDetails: { email: 'maria@empresa.com' },
      status: 'IN_PROGRESS',
    }
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([session]),
      listSessionsByClientIdSince: jest.fn().mockResolvedValue([session]),
      listMessagesByClientIdSince: jest.fn().mockResolvedValue([]),
    }
    const contactService = {
      upsertSessionWithContact: jest.fn().mockResolvedValue(undefined),
    }
    const canonicalRepository = {
      getOrCreateSyncState: jest.fn().mockResolvedValue({
        clientId: 'ferracosul',
        lastNormalizedAt: new Date('2026-06-01T09:00:00.000Z'),
      }),
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      loadWhatsAppCityIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      resolveWhatsAppCityForDepartment: jest.fn().mockResolvedValue(null),
      upsertMessage: jest.fn(),
      updateSyncState: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
      contactService as never,
    )

    await service.normalizeClient({ clientId: 'ferracosul' })

    expect(canonicalRepository.resolveWhatsAppCityForDepartment).not.toHaveBeenCalled()
    expect(contactService.upsertSessionWithContact).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappCityId: null,
        externalDepartmentId: null,
      }),
    )
  })
})
