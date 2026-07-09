import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CompaniesService } from '../application/companies.service'
import { BranchesService } from '../application/branches.service'
import { EmployeeErpUsersService } from '../application/employee-erp-users.service'
import { EmployeesService } from '../application/employees.service'
import { AuthContext } from '../../auth/domain/auth-context'
import { RequestContext } from '../../auth/presentation/decorators/request-context.decorator'
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard'
import { TenantScopeGuard } from '../../auth/presentation/guards/tenant-scope.guard'
import { parseCreateEmployeeErpUserBody } from './body/create-employee-erp-user.body'
import { parseEmployeesQuery } from './query/employees.query'

@Controller('companies')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly employeesService: EmployeesService,
    private readonly employeeErpUsersService: EmployeeErpUsersService,
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

  @Get('current/employees/:employeeId/erp-users')
  listEmployeeErpUsers(
    @RequestContext() authContext: AuthContext,
    @Param('employeeId') employeeId: string,
  ) {
    return this.employeeErpUsersService.listForEmployee(
      authContext.clientId,
      parsePositiveIntParam(employeeId, 'employeeId'),
    )
  }

  @Post('current/employees/:employeeId/erp-users')
  createEmployeeErpUser(
    @RequestContext() authContext: AuthContext,
    @Param('employeeId') employeeId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.employeeErpUsersService.create(
      authContext.clientId,
      parsePositiveIntParam(employeeId, 'employeeId'),
      parseCreateEmployeeErpUserBody(body),
    )
  }

  @Delete('current/employees/:employeeId/erp-users/:erpUserId')
  async deleteEmployeeErpUser(
    @RequestContext() authContext: AuthContext,
    @Param('employeeId') employeeId: string,
    @Param('erpUserId') erpUserId: string,
  ) {
    await this.employeeErpUsersService.remove(
      authContext.clientId,
      parsePositiveIntParam(employeeId, 'employeeId'),
      parsePositiveIntParam(erpUserId, 'erpUserId'),
    )

    return { ok: true }
  }
}

function parsePositiveIntParam(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`Invalid ${name}`)
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`Invalid ${name}`)
  }

  return parsed
}
