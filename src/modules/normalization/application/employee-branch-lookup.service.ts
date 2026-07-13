import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

export const EMPLOYEE_BRANCH_LOOKUP_READER = 'EMPLOYEE_BRANCH_LOOKUP_READER'

/** Maps ERP branch code (`raw.*.branch` / `branches.erp_id`) → Sinapse branch. */
export type EmployeeBranchLookup = {
  sellerId: number
  branchId: number | null
  branchName: string | null
}

export type EmployeeBranchLookupReader = {
  findByClientId(clientId: string): Promise<EmployeeBranchLookup[]>
}

type BranchErpLookupSqlRow = {
  sellerId: string | number | bigint
  branchId: number
  branchName: string
}

/**
 * Kept under the historic token name for DI stability.
 * Rows are keyed by ERP branch code in `sellerId` (legacy field name used as map key).
 */
@Injectable()
export class PrismaEmployeeBranchLookupReader implements EmployeeBranchLookupReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByClientId(clientId: string): Promise<EmployeeBranchLookup[]> {
    const rows = await this.prisma.$queryRaw<BranchErpLookupSqlRow[]>`
      SELECT
        b.erp_id AS "sellerId",
        b.id AS "branchId",
        b.name AS "branchName"
      FROM core.branches AS b
      WHERE b.client_id = ${clientId}
      ORDER BY b.erp_id ASC
    `

    return rows.map((row) => ({
      sellerId: Number(row.sellerId),
      branchId: row.branchId,
      branchName: row.branchName,
    }))
  }
}
