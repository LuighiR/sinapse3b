import { BadRequestException } from '@nestjs/common'
import { parseWhatsAppSummaryQuery } from './whatsapp-summary.query'

describe('parseWhatsAppSummaryQuery', () => {
  it('accepts an optional chatId filter', () => {
    expect(
      parseWhatsAppSummaryQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        chatId: ' maria@empresa.com ',
      }),
    ).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      chatId: 'maria@empresa.com',
    })
  })

  it('rejects invalid periods', () => {
    expect(() =>
      parseWhatsAppSummaryQuery({
        from: '2026-03-31',
        to: '2026-03-01',
      }),
    ).toThrow(BadRequestException)
  })
})
