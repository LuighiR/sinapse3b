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

  it('accepts an optional branchId filter', () => {
    expect(
      parseWhatsAppSummaryQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        branchId: '5',
      }),
    ).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      chatId: undefined,
      branchId: 5,
    })
  })

  it('accepts an optional whatsappCityId filter', () => {
    expect(
      parseWhatsAppSummaryQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        whatsappCityId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91',
      }).whatsappCityId,
    ).toBe('ace13d85-5f0d-4bf6-b7fb-dad921af0c91')
  })

  it('rejects invalid whatsappCityId UUID', () => {
    expect(() =>
      parseWhatsAppSummaryQuery({
        from: '2026-03-01',
        to: '2026-03-31',
        whatsappCityId: 'not-a-uuid',
      }),
    ).toThrow(BadRequestException)
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
