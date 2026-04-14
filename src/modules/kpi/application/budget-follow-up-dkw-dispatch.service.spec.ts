import { BudgetFollowUpDkwDispatchService, type BudgetFollowUpDkwDispatchCandidate } from './budget-follow-up-dkw-dispatch.service'

describe('BudgetFollowUpDkwDispatchService', () => {
  const repository = {
    listDispatchCandidates: jest.fn<Promise<BudgetFollowUpDkwDispatchCandidate[]>, [unknown]>(),
    markAsSent: jest.fn<Promise<void>, [unknown]>(),
  }
  const webhook = {
    sendLead: jest.fn<Promise<void>, [string, unknown]>(),
  }
  const branchScopeService = {
    assertBranchScope: jest.fn<Promise<void>, [string, number]>(),
  }
  const makeService = (fallbackWebhookUrl = 'https://fallback.example/lead') =>
    new BudgetFollowUpDkwDispatchService(repository, webhook, branchScopeService as any, fallbackWebhookUrl)

  const validInput = {
    clientId: 'client-1',
    from: '2026-04-01',
    to: '2026-04-02',
    referenceAt: '2026-04-02T10:00:00-03:00',
  } as const

  beforeEach(() => {
    repository.listDispatchCandidates.mockReset()
    repository.markAsSent.mockReset()
    webhook.sendLead.mockReset()
    branchScopeService.assertBranchScope.mockReset()
  })

  it('sends only rows classified as after24h open and marks them as sent', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 10,
        sentDkwAt: null,
        cellPhone: '5551999999999',
        dkwWebhook: 'https://employee.example/lead',
        budgetDatetime: '2026-04-01T08:00:00.000Z',
      }),
      makeCandidate({
        rawBudgetId: 11,
        sentDkwAt: null,
        cellPhone: '5551888888888',
        budgetDatetime: '2026-04-02T12:30:00.000Z',
      }),
    ])

    const result = await service.dispatch(validInput)

    expect(result).toEqual({
      period: {
        from: '2026-04-01',
        to: '2026-04-02',
        key: '2026-04-01_2026-04-02',
      },
      referenceAt: '2026-04-02T10:00:00-03:00',
      status: 'completed',
    })
    expect(webhook.sendLead).toHaveBeenCalledTimes(1)
    expect(webhook.sendLead).toHaveBeenCalledWith(
      'https://employee.example/lead',
      expect.objectContaining({
        name: 'ACME LTDA',
        email: 'joao@gmail.com',
        phone: '5551999999999',
        valor_orcamento: 'R$ 250,00',
        codigo_dav: '9001',
        vendedor: 'Maria',
        data_hora_abertura: '01/04/2026',
      }),
    )
    expect(repository.markAsSent).toHaveBeenCalledTimes(1)
    expect(repository.markAsSent).toHaveBeenCalledWith({
      rawBudgetId: 10,
      sentAt: expect.any(Date),
    })
  })

  it('uses phone fallback and mensagem when both phones are missing', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 20,
        cellPhone: null,
        phone: null,
        sentDkwAt: null,
      }),
    ])

    await service.dispatch(validInput)

    expect(webhook.sendLead).toHaveBeenCalledWith(
      'https://fallback.example/lead',
      expect.objectContaining({
        phone: 'Sem registro',
        mensagem: 'Sem telefone registrado',
      }),
    )
  })

  it('skips rows already sent in raw', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 30,
        sentDkwAt: '2026-04-02T09:00:00.000Z',
      }),
    ])

    await service.dispatch(validInput)

    expect(webhook.sendLead).not.toHaveBeenCalled()
    expect(repository.markAsSent).not.toHaveBeenCalled()
  })

  it('aborts after three consecutive webhook failures', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({ rawBudgetId: 1, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 2, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 3, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 4, sentDkwAt: null }),
    ])
    webhook.sendLead.mockRejectedValue(new Error('boom'))

    const result = await service.dispatch(validInput)

    expect(result.status).toBe('aborted_after_consecutive_errors')
    expect(webhook.sendLead).toHaveBeenCalledTimes(3)
    expect(repository.markAsSent).not.toHaveBeenCalled()
  })

  it('resets the consecutive failure counter after a success', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({ rawBudgetId: 1, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 2, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 3, sentDkwAt: null }),
      makeCandidate({ rawBudgetId: 4, sentDkwAt: null }),
    ])
    webhook.sendLead
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('third'))
      .mockResolvedValueOnce(undefined)

    const result = await service.dispatch(validInput)

    expect(result.status).toBe('completed')
    expect(webhook.sendLead).toHaveBeenCalledTimes(4)
    expect(repository.markAsSent).toHaveBeenCalledTimes(2)
  })

  it('falls back to the env webhook when the employee webhook is missing', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 40,
        dkwWebhook: null,
      }),
    ])

    await service.dispatch(validInput)

    expect(webhook.sendLead).toHaveBeenCalledWith(
      'https://fallback.example/lead',
      expect.objectContaining({
        codigo_dav: '9001',
      }),
    )
  })

  it('falls back to the env webhook when the employee webhook is blank', async () => {
    const service = makeService()

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 41,
        dkwWebhook: '   ',
      }),
    ])

    await service.dispatch(validInput)

    expect(webhook.sendLead).toHaveBeenCalledWith(
      'https://fallback.example/lead',
      expect.objectContaining({
        codigo_dav: '9001',
      }),
    )
  })

  it('treats a missing employee and missing env webhook as a normal item failure', async () => {
    const service = makeService('')

    repository.listDispatchCandidates.mockResolvedValue([
      makeCandidate({
        rawBudgetId: 42,
        dkwWebhook: null,
      }),
    ])

    const result = await service.dispatch(validInput)

    expect(result.status).toBe('completed')
    expect(webhook.sendLead).not.toHaveBeenCalled()
    expect(repository.markAsSent).not.toHaveBeenCalled()
  })
})

function makeCandidate(
  overrides: Partial<BudgetFollowUpDkwDispatchCandidate> = {},
): BudgetFollowUpDkwDispatchCandidate {
  return {
    rawBudgetId: 99,
    clientId: 'client-1',
    sourceRecordId: 123,
    branchId: 5,
    sellerId: 7,
    statusNormalized: 'OPEN',
    budgetDatetime: '2026-04-01T08:00:00.000Z',
    closingDate: null,
    cancellationDate: null,
    cancelationTime: null,
    payloadJson: {},
    customerName: 'ACME LTDA',
    email: 'joao@gmail.com',
    cellPhone: '5551999999999',
    phone: '5551888888888',
    valueAmount: '250.00',
    davId: '9001',
    sellerName: 'Maria',
    openingDatetime: '2026-04-01T08:00:00',
    sentDkwAt: null,
    dkwWebhook: null,
    ...overrides,
  }
}
