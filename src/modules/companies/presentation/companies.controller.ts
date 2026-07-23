import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CompaniesService } from '../application/companies.service'
import { BranchesService } from '../application/branches.service'
import { EmployeesService } from '../application/employees.service'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { parseCreateEmployeeBody } from './body/create-employee.body'
import { parseUpdateEmployeeBody } from './body/update-employee.body'
import { parseEmployeesQuery } from './query/employees.query'
import { parseEmployeeIdParam } from './params/employee-id.param'

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
    return this.employeesService.listForClient(authContext, parseEmployeesQuery(query))
  }

  @Post('current/employees')
  createCurrentCompanyEmployee(
    @RequestContext() authContext: AuthContext,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employeesService.createForClient(authContext, parseCreateEmployeeBody(body))
  }

  @Patch('current/employees/:employeeId')
  updateCurrentCompanyEmployee(
    @RequestContext() authContext: AuthContext,
    @Param('employeeId') employeeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employeesService.updateForClient(
      authContext,
      parseEmployeeIdParam(employeeId),
      parseUpdateEmployeeBody(body),
    )
  }
}
