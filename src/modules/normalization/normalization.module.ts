import { Module } from '@nestjs/common'
import { PrismaModule } from '../../infra/prisma/prisma.module'
import {
  BUDGET_FACT_UPSERT_REPOSITORY,
  BudgetNormalizationService,
  PrismaBudgetFactUpsertRepository,
  PrismaRawFerracoBudgetReader,
  RAW_FERRACO_BUDGET_READER,
} from './application/budget-normalization.service'

@Module({
  imports: [PrismaModule],
  providers: [
    BudgetNormalizationService,
    PrismaRawFerracoBudgetReader,
    PrismaBudgetFactUpsertRepository,
    {
      provide: RAW_FERRACO_BUDGET_READER,
      useExisting: PrismaRawFerracoBudgetReader,
    },
    {
      provide: BUDGET_FACT_UPSERT_REPOSITORY,
      useExisting: PrismaBudgetFactUpsertRepository,
    },
  ],
  exports: [BudgetNormalizationService],
})
export class NormalizationModule {}
