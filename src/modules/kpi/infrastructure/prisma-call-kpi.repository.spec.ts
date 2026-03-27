import { PrismaCallKpiRepository } from './prisma-call-kpi.repository'

describe('PrismaCallKpiRepository', () => {
  const utcDate = (year: number, month: number, day: number, hour = 0, minute = 0) =>
    new Date(Date.UTC(year, month, day, hour, minute))

  it('counts only inbound company call facts when resolving availability', async () => {
    const prisma = {
      callFact: {
        count: jest.fn().mockResolvedValue(1),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(repository.hasUsableCallFacts('client-1')).resolves.toBe(true)
    expect(prisma.callFact.count).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
        isInboundToCompany: true,
      },
    })
  })

  it('falls back to the extension when multiple employees share the same extension number', async () => {
    const prisma = {
      callFact: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            startedAt: utcDate(2026, 0, 5, 8, 10),
            isInboundToCompany: true,
            isReceived: false,
            isLost: true,
            agentResolutionType: 'EXTENSION_NUMBER',
            agentResolutionKey: '104',
            agentExtensionNumber: '104',
            extensionUuid: null,
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
          },
          {
            name: 'Joao',
            extensionUuid: 'ext-2',
            extensionNumber: '104',
          },
        ]),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.listCallFacts({
        clientId: 'client-1',
        from: utcDate(2026, 0, 5),
        to: utcDate(2026, 0, 5),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        agentExtensionNumber: '104',
        employeeName: null,
      }),
    ])
  })

  it('keeps the employee name when the extension uuid is uniquely resolvable', async () => {
    const prisma = {
      callFact: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            startedAt: utcDate(2026, 0, 5, 8, 10),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_UUID',
            agentResolutionKey: 'ext-1',
            agentExtensionNumber: '104',
            extensionUuid: 'ext-1',
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
          },
          {
            name: 'Joao',
            extensionUuid: 'ext-2',
            extensionNumber: '104',
          },
        ]),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.listCallFacts({
        clientId: 'client-1',
        from: utcDate(2026, 0, 5),
        to: utcDate(2026, 0, 5),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        extensionUuid: 'ext-1',
        employeeName: 'Maria',
      }),
    ])
  })
})
