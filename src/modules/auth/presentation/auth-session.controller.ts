import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { AuthSessionService } from '../application/auth-session.service'
import { parseLoginBody } from './body/login.body'
import { parseRefreshTokenBody } from './body/refresh-token.body'

@Controller('auth')
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: Record<string, unknown>) {
    return this.authSessionService.login(parseLoginBody(body))
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: Record<string, unknown>) {
    return this.authSessionService.refresh(parseRefreshTokenBody(body))
  }
}
