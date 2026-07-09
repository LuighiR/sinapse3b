import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

export const EMPLOYEE_BRANCH_LOOKUP_READER = 'EMPLOYEE_BRANCH_LOOKUP_READER'

export type EmployeeBranchLookup = {
  sellerId: number
  branchId: number | null
  branchName: string | null
}

export type EmployeeBranchLookupReader = {
  findByClientId(clientId: string): Promise<EmployeeBranchLookup[]>
}

type EmployeeBranchLookupSqlRow = {
  sellerId: string | number | bigint
  branchId: number | null
  branchName: string | null
}

@Injectable()
export class PrismaEmployeeBranchLookupReader implements EmployeeBranchLookupReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByClientId(clientId: string): Promise<EmployeeBranchLookup[]> {
    const rows = await this.prisma.$queryRaw<EmployeeBranchLookupSqlRow[]>`
      SELECT
        eu.erp_id AS "sellerId",
        eu.branch_id AS "branchId",
        b.name AS "branchName"
      FROM core.employee_erp_users AS eu
      JOIN core.branches AS b ON b.id = eu.branch_id
      WHERE eu.client_id = ${clientId}
      ORDER BY eu.erp_id ASC
    `

    return rows.map((row) => ({
      sellerId: Number(row.sellerId),
      branchId: row.branchId,
      branchName: row.branchName,
    }))
  }
}
