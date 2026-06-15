import { Controller, Headers, HttpCode, Post, Query, UnauthorizedException } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import { FlwMessagingSyncService } from '../application/flw-messaging-sync.service'
import { parseMessagingSyncQuery } from './query/messaging-sync.query'

@Controller('internal/messaging')
export class InternalMessagingSyncController {
  constructor(private readonly syncService: FlwMessagingSyncService) {}

  @Post('sync')
  @HttpCode(200)
  async sync(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    if (typeof jobKey !== 'string' || jobKey.trim() === '') {
      throw new UnauthorizedException('Missing X-Job-Key header')
    }

    const expectedJobKey = loadEnv(process.env).INTERNAL_JOB_KEY

    if (jobKey !== expectedJobKey) {
      throw new UnauthorizedException('Invalid job key')
    }

    const parsedQuery = parseMessagingSyncQuery(query)

    return this.syncService.syncClient(parsedQuery.clientId)
  }
}
