import { BadRequestException } from '@nestjs/common'
import { parseMessagingNormalizeQuery } from './messaging-normalize.query'

describe('parseMessagingNormalizeQuery', () => {
  it('accepts clientId for incremental normalization', () => {
    expect(parseMessagingNormalizeQuery({ clientId: 'ferracosul' })).toEqual({
      clientId: 'ferracosul',
      full: false,
    })
  })

  it('accepts full=true to reprocess all raw rows', () => {
    expect(parseMessagingNormalizeQuery({ clientId: 'ferracosul', full: 'true' })).toEqual({
      clientId: 'ferracosul',
      full: true,
    })
  })

  it('rejects missing clientId', () => {
    expect(() => parseMessagingNormalizeQuery({})).toThrow(BadRequestException)
  })
})
