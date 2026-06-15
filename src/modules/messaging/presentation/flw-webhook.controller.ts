import { Controller, Headers, HttpCode, Param, Post, Body, UnauthorizedException } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import { FlwWebhookIngestService } from '../application/flw-webhook-ingest.service'

@Controller('webhooks/flw')
export class FlwWebhookController {
  constructor(private readonly ingestService: FlwWebhookIngestService) {}

  @Post(':clientId/:event')
  @HttpCode(202)
  async ingest(
    @Headers('x-flw-webhook-secret') webhookSecret: string | undefined,
    @Param('clientId') clientId: string,
    @Param('event') event: string,
    @Body() payload: Record<string, unknown>,
  ) {
    const env = loadEnv(process.env)

    if (env.FLW_WEBHOOK_SECRET !== '') {
      if (webhookSecret !== env.FLW_WEBHOOK_SECRET) {
        throw new UnauthorizedException('Invalid FLW webhook secret')
      }
    }

    return this.ingestService.ingest({
      clientId,
      event,
      payload,
    })
  }
}
