import { BadRequestException, Controller, Get, Headers, HttpCode, Param, Post, Query, UnauthorizedException } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import { DkwMessagingMigrationJobService } from '../application/dkw-messaging-migration-job.service'
import { FlwMessagingSyncService } from '../application/flw-messaging-sync.service'
import { MessagingParityCheckService } from '../application/messaging-parity-check.service'
import { parseMessagingMigrateDkwQuery } from './query/messaging-migrate-dkw.query'
import { parseMessagingParityQuery } from './query/messaging-parity.query'
import { parseMessagingSyncQuery } from './query/messaging-sync.query'

@Controller('internal/messaging')
export class InternalMessagingSyncController {
  constructor(
    private readonly syncService: FlwMessagingSyncService,
    private readonly dkwMigrationJobService: DkwMessagingMigrationJobService,
    private readonly parityCheckService: MessagingParityCheckService,
  ) {}

  @Post('sync')
  @HttpCode(200)
  async sync(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    this.assertValidJobKey(jobKey)

    const parsedQuery = parseMessagingSyncQuery(query)

    return this.syncService.syncClient(parsedQuery.clientId)
  }

  @Post('migrate-dkw')
  @HttpCode(202)
  migrateDkw(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    this.assertValidJobKey(jobKey)

    const parsedQuery = parseMessagingMigrateDkwQuery(query)

    return this.dkwMigrationJobService.start(parsedQuery)
  }

  @Get('migrate-dkw/:jobId')
  getMigrateDkwStatus(
    @Headers('x-job-key') jobKey: string | undefined,
    @Param('jobId') jobId: string,
  ) {
    this.assertValidJobKey(jobKey)

    if (typeof jobId !== 'string' || jobId.trim() === '') {
      throw new BadRequestException('Invalid migration job id')
    }

    return this.dkwMigrationJobService.getStatus(jobId.trim())
  }

  @Get('parity')
  async parity(
    @Headers('x-job-key') jobKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    this.assertValidJobKey(jobKey)

    const parsedQuery = parseMessagingParityQuery(query)

    return this.parityCheckService.checkClient({
      clientId: parsedQuery.clientId,
      period: parsedQuery.period,
      topAgents: parsedQuery.topAgents,
    })
  }

  private assertValidJobKey(jobKey: string | undefined): void {
    if (typeof jobKey !== 'string' || jobKey.trim() === '') {
      throw new UnauthorizedException('Missing X-Job-Key header')
    }

    const expectedJobKey = loadEnv(process.env).INTERNAL_JOB_KEY

    if (jobKey !== expectedJobKey) {
      throw new UnauthorizedException('Invalid job key')
    }
  }
}
