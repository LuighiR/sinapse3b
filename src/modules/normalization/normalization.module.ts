import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import {
  BUDGET_FACT_UPSERT_REPOSITORY,
  BudgetNormalizationService,
  PrismaBudgetFactUpsertRepository,
  PrismaRawFerracoBudgetReader,
  RAW_FERRACO_BUDGET_READER,
} from './application/budget-normalization.service'
import {
  PrismaRawFerracoSaleReader,
  PrismaSaleFactUpsertRepository,
  RAW_FERRACO_SALE_READER,
  SALE_FACT_UPSERT_REPOSITORY,
  SaleNormalizationService,
} from './application/sale-normalization.service'
import {
  CALL_FACT_UPSERT_REPOSITORY,
  CallNormalizationService,
  PrismaCallFactUpsertRepository,
  PrismaRawFerracoCallReader,
  RAW_FERRACO_CALL_READER,
} from './application/call-normalization.service'
import {
  EMPLOYEE_BRANCH_LOOKUP_READER,
  PrismaEmployeeBranchLookupReader,
} from './application/employee-branch-lookup.service'

@Module({
  imports: [PrismaModule],
  providers: [
    BudgetNormalizationService,
    SaleNormalizationService,
    CallNormalizationService,
    PrismaRawFerracoBudgetReader,
    PrismaBudgetFactUpsertRepository,
    PrismaRawFerracoSaleReader,
    PrismaSaleFactUpsertRepository,
    PrismaEmployeeBranchLookupReader,
    PrismaRawFerracoCallReader,
    PrismaCallFactUpsertRepository,
    {
      provide: RAW_FERRACO_BUDGET_READER,
      useExisting: PrismaRawFerracoBudgetReader,
    },
    {
      provide: BUDGET_FACT_UPSERT_REPOSITORY,
      useExisting: PrismaBudgetFactUpsertRepository,
    },
    {
      provide: RAW_FERRACO_SALE_READER,
      useExisting: PrismaRawFerracoSaleReader,
    },
    {
      provide: SALE_FACT_UPSERT_REPOSITORY,
      useExisting: PrismaSaleFactUpsertRepository,
    },
    {
      provide: EMPLOYEE_BRANCH_LOOKUP_READER,
      useExisting: PrismaEmployeeBranchLookupReader,
    },
    {
      provide: RAW_FERRACO_CALL_READER,
      useExisting: PrismaRawFerracoCallReader,
    },
    {
      provide: CALL_FACT_UPSERT_REPOSITORY,
      useExisting: PrismaCallFactUpsertRepository,
    },
  ],
  exports: [BudgetNormalizationService, SaleNormalizationService, CallNormalizationService],
})
export class NormalizationModule {}
