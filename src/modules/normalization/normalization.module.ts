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

@Module({
  imports: [PrismaModule],
  providers: [
    BudgetNormalizationService,
    SaleNormalizationService,
    PrismaRawFerracoBudgetReader,
    PrismaBudgetFactUpsertRepository,
    PrismaRawFerracoSaleReader,
    PrismaSaleFactUpsertRepository,
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
  ],
  exports: [BudgetNormalizationService, SaleNormalizationService],
})
export class NormalizationModule {}
