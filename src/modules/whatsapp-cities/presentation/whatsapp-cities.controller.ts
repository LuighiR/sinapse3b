import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { WhatsAppCitiesService } from '../application/whatsapp-cities.service'
import { parseCreateWhatsAppCityBody } from './body/create-whatsapp-city.body'
import { parseUpdateWhatsAppCityBody } from './body/update-whatsapp-city.body'
import { parseListWhatsAppCitiesQuery } from './query/list-whatsapp-cities.query'

@Controller('whatsapp-cities')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class WhatsAppCitiesController {
  constructor(private readonly whatsAppCitiesService: WhatsAppCitiesService) {}

  @Get()
  list(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    return this.whatsAppCitiesService.list(authContext, parseListWhatsAppCitiesQuery(query))
  }

  @Post()
  create(@RequestContext() authContext: AuthContext, @Body() body: Record<string, unknown>) {
    return this.whatsAppCitiesService.create(authContext, parseCreateWhatsAppCityBody(body))
  }

  @Patch(':id')
  update(
    @RequestContext() authContext: AuthContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.whatsAppCitiesService.update(authContext, id, parseUpdateWhatsAppCityBody(body))
  }
}
