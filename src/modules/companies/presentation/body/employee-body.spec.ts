import { BadRequestException } from '@nestjs/common'
import { parseCreateEmployeeBody } from './create-employee.body'
import { parseUpdateEmployeeBody } from './update-employee.body'

describe('employee body parsers', () => {
  it('parses a valid create payload and normalizes empty optional text to null', () => {
    expect(
      parseCreateEmployeeBody({
        name: '  Nova Pessoa  ',
        branchId: 1,
        erpId: '42754',
        extensionNumber: '  ',
        extensionUuid: '',
        chatId: null,
        isNonCommercial: true,
      }),
    ).toEqual({
      name: 'Nova Pessoa',
      branchId: 1,
      erpId: 42754,
      extensionNumber: null,
      extensionUuid: null,
      chatId: null,
      isNonCommercial: true,
    })
  })

  it('rejects create payload without required fields', () => {
    expect(() => parseCreateEmployeeBody({ name: 'Only Name' })).toThrow(BadRequestException)
  })

  it('parses a partial update payload and requires at least one field', () => {
    expect(parseUpdateEmployeeBody({ isActive: false })).toEqual({ isActive: false })
    expect(() => parseUpdateEmployeeBody({})).toThrow(BadRequestException)
  })

  it('keeps explicit null on update optional fields', () => {
    expect(
      parseUpdateEmployeeBody({
        chatId: null,
        extensionUuid: '  ext-1  ',
      }),
    ).toEqual({
      chatId: null,
      extensionUuid: 'ext-1',
    })
  })
})
