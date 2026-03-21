import { Injectable } from '@nestjs/common'
import { AuthContext } from '../domain/auth-context'
import { UserMembershipService } from './user-membership.service'

@Injectable()
export class RequestContextService {
  constructor(private readonly userMembershipService: UserMembershipService) {}

  async resolve(userId: string, tenantId: string): Promise<AuthContext> {
    const scope = await this.userMembershipService.resolveActiveScope(userId, tenantId)

    return {
      userId,
      tenantId: scope.tenant.id,
      clientId: scope.client.id,
      user: scope.user,
      membership: scope.membership,
      tenant: scope.tenant,
      client: scope.client,
    }
  }
}
