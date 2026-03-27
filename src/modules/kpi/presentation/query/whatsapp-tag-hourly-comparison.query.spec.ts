import { BadRequestException } from '@nestjs/common'
import { parseWhatsAppTagHourlyComparisonQuery } from './whatsapp-tag-hourly-comparison.query'

describe('parseWhatsAppTagHourlyComparisonQuery', () => {
  it('accepts chatId and sellerId filters', () => {
    expect(
      parseWhatsAppTagHourlyComparisonQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        tagId: '21830',
        chatId: ' maria@empresa.com ',
        sellerId: ' 35747 ',
      }),
    ).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      tagId: '21830',
      chatId: 'maria@empresa.com',
      sellerId: 35747,
    })
  })

  it('rejects invalid sellerId values', () => {
    expect(() =>
      parseWhatsAppTagHourlyComparisonQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        tagId: '21830',
        sellerId: 'abc',
      }),
    ).toThrow(BadRequestException)
  })
})
