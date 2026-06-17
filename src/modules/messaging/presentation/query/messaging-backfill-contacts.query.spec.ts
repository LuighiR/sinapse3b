import { BadRequestException } from '@nestjs/common'
import { parseMessagingBackfillContactsQuery } from './messaging-backfill-contacts.query'

describe('parseMessagingBackfillContactsQuery', () => {
  it('accepts clientId only for a full backfill', () => {
    expect(parseMessagingBackfillContactsQuery({ clientId: 'ferracosul' })).toEqual({
      clientId: 'ferracosul',
      period: undefined,
    })
  })

  it('accepts clientId with from and to for a ranged backfill', () => {
    const parsed = parseMessagingBackfillContactsQuery({
      clientId: 'ferracosul',
      from: '2024-01-01',
      to: '2024-01-31',
    })

    expect(parsed.clientId).toBe('ferracosul')
    expect(parsed.period).toBeDefined()
  })

  it('rejects partial date filters', () => {
    expect(() =>
      parseMessagingBackfillContactsQuery({
        clientId: 'ferracosul',
        from: '2024-01-01',
      }),
    ).toThrow(BadRequestException)
  })
})
