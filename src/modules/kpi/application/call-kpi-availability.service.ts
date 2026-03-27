export type CallKpiAvailabilityInput = {
  clientId: string
  definitionId: bigint
  metadataJson?: Record<string, unknown> | null
}

export type CallKpiAvailabilityUpdate = CallKpiAvailabilityInput & {
  isEnabled: boolean
  availableAt: Date | null
}

export type CallKpiAvailabilityRefreshInput = {
  clientId: string
  definitionIds: bigint[]
  metadataJson?: Record<string, unknown> | null
}

export type CallKpiAvailabilityRepository = {
  hasUsableCallFacts(clientId: string): Promise<boolean>
  upsertAvailability(input: CallKpiAvailabilityUpdate): Promise<void>
}

export class CallKpiAvailabilityService {
  constructor(private readonly repository: CallKpiAvailabilityRepository) {}

  async refreshCallAvailability(input: CallKpiAvailabilityInput): Promise<boolean> {
    return this.refreshCallAvailabilityForDefinitions({
      clientId: input.clientId,
      definitionIds: [input.definitionId],
      metadataJson: input.metadataJson ?? null,
    })
  }

  async refreshCallAvailabilityForDefinitions(input: CallKpiAvailabilityRefreshInput): Promise<boolean> {
    const isEnabled = await this.repository.hasUsableCallFacts(input.clientId)

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
