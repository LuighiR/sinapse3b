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
            id: 1,
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
          },
          {
            id: 2,
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

  it('excludes call facts resolved to non-commercial employees from all call KPIs', async () => {
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
          {
            id: 2,
            startedAt: utcDate(2026, 0, 5, 8, 20),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_UUID',
            agentResolutionKey: 'ext-2',
            agentExtensionNumber: '105',
            extensionUuid: 'ext-2',
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
            isNonCommercial: false,
          },
          {
            name: 'Backoffice',
            extensionUuid: 'ext-2',
            extensionNumber: '105',
            isNonCommercial: true,
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
        id: 1,
        employeeName: 'Maria',
      }),
    ])
  })

  it('filters call facts by the selected branch and uses employees only for labels', async () => {
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
          {
            id: 2,
            startedAt: utcDate(2026, 0, 5, 8, 20),
            isInboundToCompany: true,
            isReceived: false,
            isLost: true,
            agentResolutionType: 'EXTENSION_NUMBER',
            agentResolutionKey: '104',
            agentExtensionNumber: '104',
            extensionUuid: null,
          },
          {
            id: 3,
            startedAt: utcDate(2026, 0, 5, 8, 30),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_NUMBER',
            agentResolutionKey: '108',
            agentExtensionNumber: '108',
            extensionUuid: null,
          },
          {
            id: 4,
            startedAt: utcDate(2026, 0, 5, 8, 40),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_UUID',
            agentResolutionKey: 'missing',
            agentExtensionNumber: '999',
            extensionUuid: 'missing',
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
          },
          {
            id: 2,
            name: 'Joao',
            extensionUuid: 'ext-2',
            extensionNumber: '104',
          },
          {
            id: 3,
            name: 'Ana',
            extensionUuid: 'ext-3',
            extensionNumber: '108',
          },
        ]),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.getCallFactRows({
        clientId: 'client-1',
        period: {
          from: utcDate(2026, 0, 5),
          to: utcDate(2026, 0, 5),
          key: '2026-01-05_2026-01-05',
        } as any,
        branchId: 10,
      } as any),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        employeeName: 'Maria',
      }),
      expect.objectContaining({
        id: 2,
        employeeName: null,
      }),
      expect.objectContaining({
        id: 3,
        employeeName: 'Ana',
      }),
      expect.objectContaining({
        id: 4,
        employeeName: null,
      }),
    ])
  })

  it('filters branch call facts by callFact.branchId without requiring an employee match', async () => {
    const prisma = {
      callFact: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            startedAt: utcDate(2026, 0, 5, 8, 10),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: null,
            agentResolutionKey: null,
            agentExtensionNumber: null,
            extensionUuid: null,
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.listCallFacts({
        clientId: 'client-1',
        from: utcDate(2026, 0, 5),
        to: utcDate(2026, 0, 5),
        branchId: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        employeeName: null,
      }),
    ])

    expect(prisma.callFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'client-1',
          branchId: 10,
          startedAt: {
            gte: utcDate(2026, 0, 5),
            lt: utcDate(2026, 0, 6),
          },
        },
      }),
    )
  })

  it('excludes branch call facts resolved to non-commercial employees without using employees to scope the branch', async () => {
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
          {
            id: 2,
            startedAt: utcDate(2026, 0, 5, 8, 20),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_UUID',
            agentResolutionKey: 'ext-2',
            agentExtensionNumber: '105',
            extensionUuid: 'ext-2',
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
            isNonCommercial: false,
          },
          {
            id: 2,
            name: 'Backoffice',
            extensionUuid: 'ext-2',
            extensionNumber: '105',
            isNonCommercial: true,
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
        branchId: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        employeeName: 'Maria',
      }),
    ])

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 10,
        },
      }),
    )
    expect(prisma.callFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'client-1',
          branchId: 10,
          startedAt: {
            gte: utcDate(2026, 0, 5),
            lt: utcDate(2026, 0, 6),
          },
        },
      }),
    )
  })

  it('keeps branch call facts with ambiguous primary extension number without an employee label', async () => {
    const prisma = {
      callFact: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            startedAt: utcDate(2026, 0, 5, 8, 10),
            isInboundToCompany: true,
            isReceived: true,
            isLost: false,
            agentResolutionType: 'EXTENSION_NUMBER',
            agentResolutionKey: '104',
            agentExtensionNumber: '999',
            extensionUuid: null,
          },
        ]),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '999',
          },
          {
            id: 2,
            name: 'Joao',
            extensionUuid: 'ext-2',
            extensionNumber: '999',
          },
          {
            id: 3,
            name: 'Ana',
            extensionUuid: 'ext-3',
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
        branchId: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        employeeName: null,
      }),
    ])
  })

  it('keeps branch call facts with ambiguous extension uuid without an employee label', async () => {
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
            id: 1,
            name: 'Maria',
            extensionUuid: 'ext-1',
            extensionNumber: '104',
          },
          {
            id: 2,
            name: 'Joao',
            extensionUuid: 'ext-1',
            extensionNumber: '107',
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
        branchId: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        employeeName: null,
      }),
    ])
  })

  it('filters telemarketing budgets by branchId when requested', async () => {
    const prisma = {
      budgetFact: {
        findMany: jest.fn().mockResolvedValue([
          {
            budgetDatetime: utcDate(2026, 0, 5, 8, 10),
            statusNormalized: 'OPEN',
          },
        ]),
      },
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.getTelemarketingBudgetRows({
        clientId: 'client-1',
        period: {
          from: utcDate(2026, 0, 5),
          to: utcDate(2026, 0, 5),
          key: '2026-01-05_2026-01-05',
        } as any,
        branchId: 10,
      } as any),
    ).resolves.toEqual([
      {
        budgetDatetime: utcDate(2026, 0, 5, 8, 10),
        statusNormalized: 'OPEN',
      },
    ])

    expect(prisma.budgetFact.findMany).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
        channel: 'Pedido Televendas',
        budgetDatetime: {
          gte: utcDate(2026, 0, 5),
          lt: utcDate(2026, 0, 6),
        },
        branchId: 10,
      },
      orderBy: [{ budgetDatetime: 'asc' }, { id: 'asc' }],
      select: {
        budgetDatetime: true,
        statusNormalized: true,
      },
    })
  })

  it('extends the interactive transaction timeout when persisting materialization', async () => {
    const tx = {
      kpiSnapshot: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      kpiBreakdown: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    }
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback, options) => {
        expect(options).toMatchObject({
          maxWait: 10_000,
          timeout: 30_000,
        })

        return callback(tx)
      }),
    }

    const repository = new PrismaCallKpiRepository(prisma as any)

    await expect(
      repository.persistMaterialization({
        clientId: 'client-1',
        summaryDefinitionId: 1n,
        hourlyDefinitionId: 2n,
        agentRankingDefinitionId: 3n,
        hourlyComparisonDefinitionId: 4n,
        period: {
          from: utcDate(2026, 2, 1),
          to: utcDate(2026, 2, 31),
          key: '2026-03-01_2026-03-31',
          eachDay: () => [],
        } as any,
        summaryRows: [
          {
            metricKey: 'received.count',
            metricValue: '1',
            dimensionsJson: { family: 'calls' },
          },
        ],
        hourlyRows: [],
        rankingRows: [],
        comparisonRows: [],
      }),
    ).resolves.toEqual({
      snapshotsCreated: 1,
      breakdownsCreated: 0,
    })
  })
})
