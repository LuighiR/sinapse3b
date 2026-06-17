import { DkwContactEnricherService } from './dkw-contact-enricher.service'

describe('DkwContactEnricherService', () => {
  it('matches legacy contacts by numeric external id', async () => {
    const prisma = {
      contact: {
        findFirst: jest.fn().mockResolvedValue({ id: 999n }),
        findMany: jest.fn(),
      },
    }

    const service = new DkwContactEnricherService(prisma as never)

    await expect(
      service.resolveLegacyContactId({
        clientId: 'ferracosul',
        externalContactId: '999',
        phoneNormalized: null,
      }),
    ).resolves.toBe(999n)
  })

  it('falls back to normalized phone match when id lookup misses', async () => {
    const prisma = {
      contact: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1234n,
            number: '(11) 99999-9999',
          },
        ]),
      },
    }

    const service = new DkwContactEnricherService(prisma as never)

    await expect(
      service.resolveLegacyContactId({
        clientId: 'ferracosul',
        externalContactId: '5511999999999',
        phoneNormalized: '5511999999999',
      }),
    ).resolves.toBe(1234n)
  })
})
