import { BadRequestException } from '@nestjs/common'

export function parseInternalKpiRefreshJobIdParam(jobId: string): string {
  const normalized = jobId.trim()

  if (normalized === '' || !/^\d+$/.test(normalized)) {
    throw new BadRequestException('Invalid internal KPI refresh job id')
  }

  return normalized
}
