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
        e.erp_id AS "sellerId",
        CASE WHEN count(*) = 1 THEN min(e.branch_id) ELSE NULL::integer END AS "branchId",
        CASE WHEN count(*) = 1 THEN min(b.name) ELSE NULL::text END AS "branchName"
      FROM core.employees AS e
      JOIN core.branches AS b ON b.id = e.branch_id
      WHERE b.client_id = ${clientId}
      GROUP BY e.erp_id
      ORDER BY e.erp_id ASC
    `

    return rows.map((row) => ({
      sellerId: Number(row.sellerId),
      branchId: row.branchId,
      branchName: row.branchName,
    }))
  }
}
