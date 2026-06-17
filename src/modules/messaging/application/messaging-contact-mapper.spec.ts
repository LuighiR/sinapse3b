import { mapSessionToMessagingContact } from './messaging-contact-mapper'
import { MessagingSessionWritePayload } from '../domain/messaging-types'

describe('mapSessionToMessagingContact', () => {
  it('builds a FLW contact from session contactExternalId', () => {
    const session: MessagingSessionWritePayload = {
      id: 'ferracosul:FLW:session-1',
      clientId: 'ferracosul',
      branchId: 2,
      provider: 'FLW',
      externalSessionId: 'session-1',
      contactExternalId: 'contact-uuid',
      assignedAgentEmail: 'maria@empresa.com',
      assignedAgentUserId: 'agent-1',
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-06-01T10:00:00.000Z'),
      endedAt: null,
      rawJson: { contactId: 'contact-uuid' },
    }

    expect(mapSessionToMessagingContact({ session })).toEqual({
      id: 'ferracosul:FLW:contact-uuid',
      clientId: 'ferracosul',
      provider: 'FLW',
      externalContactId: 'contact-uuid',
      displayName: null,
      phoneNormalized: null,
      legacyContactId: null,
      rawJson: session.rawJson,
    })
  })

  it('builds a DKW contact with normalized phone from ticket', () => {
    const session: MessagingSessionWritePayload = {
      id: 'ferracosul:DKW:12345',
      clientId: 'ferracosul',
      branchId: null,
      provider: 'DKW',
      externalSessionId: '12345',
      contactExternalId: '999',
      assignedAgentEmail: null,
      assignedAgentUserId: null,
      status: 'OPEN',
      startedAt: new Date('2026-01-10T08:00:00.000Z'),
      endedAt: null,
      rawJson: {
        ticket: {
          contactExternalId: 999,
          contactNumber: '11999999999',
        },
      },
    }

    expect(mapSessionToMessagingContact({ session })).toEqual(
      expect.objectContaining({
        id: 'ferracosul:DKW:999',
        externalContactId: '999',
        phoneNormalized: '5511999999999',
        displayName: '11999999999',
      }),
    )
  })

  it('returns null when session has no contact external id', () => {
    const session: MessagingSessionWritePayload = {
      id: 'ferracosul:FLW:session-1',
      clientId: 'ferracosul',
      branchId: null,
      provider: 'FLW',
      externalSessionId: 'session-1',
      contactExternalId: null,
      assignedAgentEmail: null,
      assignedAgentUserId: null,
      status: null,
      startedAt: new Date('2026-06-01T10:00:00.000Z'),
      endedAt: null,
      rawJson: {},
    }

    expect(mapSessionToMessagingContact({ session })).toBeNull()
  })
})
