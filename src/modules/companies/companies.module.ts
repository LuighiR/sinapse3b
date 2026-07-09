import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { BranchScopeService } from './application/branch-scope.service'
import { BranchesService } from './application/branches.service'
import { CompaniesService } from './application/companies.service'
import { EmployeeErpUsersService } from './application/employee-erp-users.service'
import { EmployeesService } from './application/employees.service'
import { CompaniesController } from './presentation/companies.controller'

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, BranchesService, BranchScopeService, EmployeesService, EmployeeErpUsersService],
  exports: [BranchScopeService],
})
export class CompaniesModule {}
