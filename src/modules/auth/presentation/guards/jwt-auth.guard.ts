import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtAuthClaims, JwtAuthService } from '../../application/jwt-auth.service'

type RequestWithJwt = {
  headers: Record<string, string | string[] | undefined>
  authClaims?: JwtAuthClaims
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithJwt>()
    const authorization = request.headers.authorization

    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const token = authorization.slice('Bearer '.length).trim()

    if (token === '') {
      throw new UnauthorizedException('Missing bearer token')
    }

    request.authClaims = await this.jwtAuthService.verify(token)
    return true
  }
}
