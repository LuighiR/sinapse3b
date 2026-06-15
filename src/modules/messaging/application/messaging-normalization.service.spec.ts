import { MessagingNormalizationService } from './messaging-normalization.service'

describe('MessagingNormalizationService', () => {
  it('normalizes raw FLW sessions and messages into canonical tables', async () => {
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
      listMessagesByClientId: jest.fn().mockResolvedValue([
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
    const canonicalRepository = {
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map([['dept-1', 2]])),
      upsertSession: jest.fn().mockResolvedValue(undefined),
      upsertMessage: jest.fn().mockResolvedValue(undefined),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
    )

    const result = await service.normalizeClient('ferracosul')

    expect(result).toEqual({
      sessionsWritten: 1,
      messagesWritten: 1,
    })
    expect(canonicalRepository.upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ferracosul:FLW:session-1',
        branchId: 2,
        assignedAgentEmail: 'maria@empresa.com',
      }),
    )
    expect(canonicalRepository.upsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ferracosul:FLW:message-1',
        sessionId: 'ferracosul:FLW:session-1',
        direction: 'INBOUND',
      }),
    )
  })

  it('skips messages when the session was not normalized', async () => {
    const rawRepository = {
      listSessionsByClientId: jest.fn().mockResolvedValue([]),
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
    const canonicalRepository = {
      loadBranchIdByDepartmentId: jest.fn().mockResolvedValue(new Map()),
      upsertSession: jest.fn(),
      upsertMessage: jest.fn(),
    }

    const service = new MessagingNormalizationService(
      rawRepository as never,
      canonicalRepository as never,
    )

    const result = await service.normalizeClient('ferracosul')

    expect(result).toEqual({
      sessionsWritten: 0,
      messagesWritten: 0,
    })
    expect(canonicalRepository.upsertMessage).not.toHaveBeenCalled()
  })
})
