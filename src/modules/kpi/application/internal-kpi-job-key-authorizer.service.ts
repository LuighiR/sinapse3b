import { Injectable, UnauthorizedException } from '@nestjs/common'
import { loadEnv } from '../../../config/env'

@Injectable()
export class InternalKpiJobKeyAuthorizerService {
  assertValid(jobKey: string) {
    const expectedJobKey = loadEnv(process.env).INTERNAL_JOB_KEY

    if (jobKey.trim() === '' || jobKey !== expectedJobKey) {
      throw new UnauthorizedException('Invalid job key')
    }
  }
}
