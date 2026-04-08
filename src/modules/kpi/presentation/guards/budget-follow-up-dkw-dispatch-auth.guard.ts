import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { InternalKpiJobKeyAuthorizerService } from '../../application/internal-kpi-job-key-authorizer.service'
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../../auth/presentation/guards/tenant-scope.guard'

type RequestWithHeaders = {
  headers: Record<string, string | string[] | undefined>
}

@Injectable()
export class BudgetFollowUpDkwDispatchAuthGuard implements CanActivate {
  constructor(
    private readonly jobKeyAuthorizer: InternalKpiJobKeyAuthorizerService,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly tenantScopeGuard: TenantScopeGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>()
    const rawJobKey = request.headers['x-job-key']
    const jobKey = Array.isArray(rawJobKey) ? rawJobKey[0] : rawJobKey

    if (typeof jobKey === 'string' && jobKey.trim() !== '') {
      this.jobKeyAuthorizer.assertValid(jobKey)
      return true
    }

    await this.jwtAuthGuard.canActivate(context)
    await this.tenantScopeGuard.canActivate(context)
    return true
  }
}
