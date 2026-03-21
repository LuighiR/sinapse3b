import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { UserMembershipService } from '../../auth/application/user-membership.service'
import { JwtAuthClaims } from '../../auth/application/jwt-auth.service'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'

type RequestWithClaims = {
  authClaims?: JwtAuthClaims
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly userMembershipService: UserMembershipService) {}

  @Get()
  async getMe(@Req() request: RequestWithClaims) {
    return this.userMembershipService.getUserSummary(this.getUserId(request))
  }

  @Get('tenants')
  async getTenants(@Req() request: RequestWithClaims) {
    return this.userMembershipService.listActiveTenants(this.getUserId(request))
  }

  private getUserId(request: RequestWithClaims) {
    return request.authClaims?.sub ?? ''
  }
}
