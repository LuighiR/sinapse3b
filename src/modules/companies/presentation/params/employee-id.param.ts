import { BadRequestException } from '@nestjs/common'

export function parseEmployeeIdParam(employeeId: string): number {
  const trimmed = employeeId.trim()

  if (!/^\d+$/.test(trimmed)) {
    throw new BadRequestException('Invalid employee id')
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException('Invalid employee id')
  }

  return parsed
}
