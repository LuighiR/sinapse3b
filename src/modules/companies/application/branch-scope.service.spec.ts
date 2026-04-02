import { ForbiddenException } from '@nestjs/common'
import { BranchScopeService } from './branch-scope.service'

describe('BranchScopeService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows branch scope validation to be skipped when branchId is omitted', async () => {
    const service = new BranchScopeService()

    await expect(service.assertBranchScope('client-1')).resolves.toBeUndefined()
  })

  it('allows a branch that belongs to the active client from fixtures', async () => {
    const service = new BranchScopeService({
      branches: [
        { id: 10, clientId: 'client-1' },
        { id: 20, clientId: 'client-2' },
      ],
    })

    await expect(service.assertBranchScope('client-1', 10)).resolves.toBeUndefined()
  })

  it('rejects a branch that belongs to another client from fixtures', async () => {
    const service = new BranchScopeService({
      branches: [{ id: 10, clientId: 'client-2' }],
    })

    await expect(service.assertBranchScope('client-1', 10)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.assertBranchScope('client-1', 10)).rejects.toThrow('Branch is outside the active client scope')
  })

  it('allows a branch that belongs to the active client from prisma', async () => {
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, clientId: 'client-1' }),
      },
    }

    const service = new BranchScopeService(null, prisma as any)

    await expect(service.assertBranchScope('client-1', 10)).resolves.toBeUndefined()
    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { id: true, clientId: true },
    })
  })

  it('rejects a branch that does not belong to the active client from prisma', async () => {
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, clientId: 'client-2' }),
      },
    }

    const service = new BranchScopeService(null, prisma as any)

    await expect(service.assertBranchScope('client-1', 10)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.assertBranchScope('client-1', 10)).rejects.toThrow('Branch is outside the active client scope')
  })
})
