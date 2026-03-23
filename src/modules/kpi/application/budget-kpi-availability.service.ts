export type BudgetKpiAvailabilityInput = {
  clientId: string
  definitionId: bigint
  metadataJson?: Record<string, unknown> | null
}

export type BudgetKpiAvailabilityUpdate = BudgetKpiAvailabilityInput & {
  isEnabled: boolean
  availableAt: Date | null
}

export type BudgetKpiAvailabilityRefreshInput = {
  clientId: string
  definitionIds: bigint[]
  metadataJson?: Record<string, unknown> | null
}

export type BudgetKpiAvailabilityRepository = {
  hasUsableBudgetFacts(clientId: string): Promise<boolean>
  upsertAvailability(input: BudgetKpiAvailabilityUpdate): Promise<void>
}

export class BudgetKpiAvailabilityService {
  constructor(private readonly repository: BudgetKpiAvailabilityRepository) {}

  async refreshBudgetAvailability(input: BudgetKpiAvailabilityInput): Promise<boolean> {
    return this.refreshBudgetAvailabilityForDefinitions({
      clientId: input.clientId,
      definitionIds: [input.definitionId],
      metadataJson: input.metadataJson ?? null,
    })
  }

  async refreshBudgetAvailabilityForDefinitions(
    input: BudgetKpiAvailabilityRefreshInput,
  ): Promise<boolean> {
    const isEnabled = await this.repository.hasUsableBudgetFacts(input.clientId)

    for (const definitionId of input.definitionIds) {
      await this.repository.upsertAvailability({
        clientId: input.clientId,
        definitionId,
        isEnabled,
        availableAt: isEnabled ? new Date() : null,
        metadataJson: input.metadataJson ?? null,
      })
    }

    return isEnabled
  }
}
