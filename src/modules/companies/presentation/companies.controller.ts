import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CompaniesService } from '../application/companies.service'
import { BranchesService } from '../application/branches.service'
import { EmployeesService } from '../application/employees.service'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { parseEmployeesQuery } from './query/employees.query'

@Controller('companies')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get('current')
  getCurrentCompany(@RequestContext() authContext: AuthContext) {
    return this.companiesService.getCurrentCompany(authContext.clientId)
  }

  @Get('current/branches')
  getCurrentCompanyBranches(@RequestContext() authContext: AuthContext) {
    return this.branchesService.listForClient(authContext.clientId)
  }

  @Get('current/employees')
  getCurrentCompanyEmployees(
    @RequestContext() authContext: AuthContext,
    @Query() query: Record<string, unknown>,
  ) {
    return this.employeesService.listForClient(authContext.clientId, parseEmployeesQuery(query))
  }
}
