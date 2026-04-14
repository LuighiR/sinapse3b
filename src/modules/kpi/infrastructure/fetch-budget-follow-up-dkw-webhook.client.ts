import { Injectable } from '@nestjs/common'
import {
  type BudgetFollowUpDkwWebhookClient,
  type BudgetFollowUpDkwWebhookPayload,
} from '../application/budget-follow-up-dkw-dispatch.service'

@Injectable()
export class FetchBudgetFollowUpDkwWebhookClient implements BudgetFollowUpDkwWebhookClient {
  async sendLead(url: string, payload: BudgetFollowUpDkwWebhookPayload): Promise<void> {
    if (url.trim().length === 0) {
      throw new Error('DKW webhook URL is not configured')
    }

    const response = await fetch(url, {
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
