export type SaleKpiAvailabilityInput = {
  clientId: string
  definitionId: bigint
  metadataJson?: Record<string, unknown> | null
}

export type SaleKpiAvailabilityUpdate = SaleKpiAvailabilityInput & {
  isEnabled: boolean
  availableAt: Date | null
}

export type SaleKpiAvailabilityRefreshInput = {
  clientId: string
  definitionIds: bigint[]
  metadataJson?: Record<string, unknown> | null
}

export type SaleKpiAvailabilityRepository = {
  hasUsableSaleFacts(clientId: string): Promise<boolean>
  upsertAvailability(input: SaleKpiAvailabilityUpdate): Promise<void>
}

export class SaleKpiAvailabilityService {
  constructor(private readonly repository: SaleKpiAvailabilityRepository) {}

  async refreshSaleAvailability(input: SaleKpiAvailabilityInput): Promise<boolean> {
    return this.refreshSaleAvailabilityForDefinitions({
      clientId: input.clientId,
      definitionIds: [input.definitionId],
      metadataJson: input.metadataJson ?? null,
    })
  }

  async refreshSaleAvailabilityForDefinitions(input: SaleKpiAvailabilityRefreshInput): Promise<boolean> {
    const isEnabled = await this.repository.hasUsableSaleFacts(input.clientId)

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
