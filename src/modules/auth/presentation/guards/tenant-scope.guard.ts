import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { RequestContextService } from '../../application/request-context.service'
import { JwtAuthClaims } from '../../application/jwt-auth.service'
import { AuthContext } from '../../domain/auth-context'

type RequestWithContext = {
  headers: Record<string, string | string[] | undefined>
  authClaims?: JwtAuthClaims
  authContext?: AuthContext
}

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly requestContextService: RequestContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithContext>()
    const tenantHeader = request.headers['x-tenant-id']
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader

    if (typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new BadRequestException('X-Tenant-Id header is required')
    }

    const userId = request.authClaims?.sub

    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new UnauthorizedException('Missing authenticated user context')
    }

    request.authContext = await this.requestContextService.resolve(userId, tenantId)
    return true
  }
}
