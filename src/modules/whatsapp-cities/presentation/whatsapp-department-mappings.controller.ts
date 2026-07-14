import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { WhatsAppDepartmentMappingsService } from '../application/whatsapp-department-mappings.service'
import { parseCreateWhatsAppDepartmentMappingBody } from './body/create-whatsapp-department-mapping.body'
import { parseUpdateWhatsAppDepartmentMappingBody } from './body/update-whatsapp-department-mapping.body'
import { parseListWhatsAppDepartmentMappingsQuery } from './query/list-whatsapp-department-mappings.query'

@Controller('whatsapp-department-mappings')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class WhatsAppDepartmentMappingsController {
  constructor(private readonly whatsAppDepartmentMappingsService: WhatsAppDepartmentMappingsService) {}

  @Get()
  list(@RequestContext() authContext: AuthContext, @Query() query: Record<string, unknown>) {
    return this.whatsAppDepartmentMappingsService.list(
      authContext,
      parseListWhatsAppDepartmentMappingsQuery(query),
    )
  }

  @Post()
  create(@RequestContext() authContext: AuthContext, @Body() body: Record<string, unknown>) {
    return this.whatsAppDepartmentMappingsService.create(
      authContext,
      parseCreateWhatsAppDepartmentMappingBody(body),
    )
  }

  @Patch(':id')
  update(
    @RequestContext() authContext: AuthContext,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.whatsAppDepartmentMappingsService.update(
      authContext,
      id,
      parseUpdateWhatsAppDepartmentMappingBody(body),
    )
  }
}
