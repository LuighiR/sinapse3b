import { Injectable } from '@nestjs/common'
import { loadEnv } from '../../../config/env'
import {
  type BudgetFollowUpDkwWebhookClient,
  type BudgetFollowUpDkwWebhookPayload,
} from '../application/budget-follow-up-dkw-dispatch.service'

@Injectable()
export class FetchBudgetFollowUpDkwWebhookClient implements BudgetFollowUpDkwWebhookClient {
  private readonly webhookUrl = loadEnv().BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL

  async sendLead(payload: BudgetFollowUpDkwWebhookPayload): Promise<void> {
    if (this.webhookUrl.length === 0) {
      throw new Error('BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL is not configured')
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`DKW webhook request failed with status ${response.status}`)
    }
  }
}
