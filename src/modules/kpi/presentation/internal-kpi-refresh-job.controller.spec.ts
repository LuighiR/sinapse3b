import { ConflictException, INestApplication, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { InternalKpiRefreshJobCreateService } from '../application/internal-kpi-refresh-job-create.service'
import { InternalKpiRefreshJobStatusService } from '../application/internal-kpi-refresh-job-status.service'
import { InternalKpiRefreshJobController } from './internal-kpi-refresh-job.controller'

describe('InternalKpiRefreshJobController', () => {
  let app: INestApplication
  const createService = {
    create: jest.fn(),
  }
  const statusService = {
    getStatus: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalKpiRefreshJobController],
      providers: [
        {
          provide: InternalKpiRefreshJobCreateService,
          useValue: createService,
        },
        {
          provide: InternalKpiRefreshJobStatusService,
          useValue: statusService,
        },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 202 without Authorization or X-Tenant-Id when the job is accepted', async () => {
    createService.create.mockResolvedValue({
      status: 'accepted',
      message: 'task initiated',
      jobId: '41',
    })

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(202)
      .expect({
        status: 'accepted',
        message: 'task initiated',
        jobId: '41',
      })

    expect(createService.create).toHaveBeenCalledWith({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })
  })

  it('returns persisted job status from GET without Authorization or X-Tenant-Id', async () => {
    statusService.getStatus.mockResolvedValue({
      jobId: '41',
      status: 'RUNNING',
      slug: 'ferracosul-kpi-dev',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      from: '2026-04-01',
      to: '2026-04-06',
      triggerType: 'api',
      requestedAt: '2026-04-08T12:00:00.000Z',
      startedAt: '2026-04-08T12:00:01.000Z',
      finishedAt: null,
      errorMessage: null,
      results: null,
    })

    await request(app.getHttpServer())
      .get('/internal/jobs/kpis/refresh/41')
      .set('X-Job-Key', 'job-secret')
      .expect(200)
      .expect({
        jobId: '41',
        status: 'RUNNING',
        slug: 'ferracosul-kpi-dev',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        from: '2026-04-01',
        to: '2026-04-06',
        triggerType: 'api',
        requestedAt: '2026-04-08T12:00:00.000Z',
        startedAt: '2026-04-08T12:00:01.000Z',
        finishedAt: null,
        errorMessage: null,
        results: null,
      })

    expect(statusService.getStatus).toHaveBeenCalledWith({
      jobId: '41',
      jobKey: 'job-secret',
    })
  })

  it('returns 401 when the X-Job-Key header is missing', async () => {
    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .expect(401)

    expect(createService.create).not.toHaveBeenCalled()
  })

  it('returns 401 when the post job key is invalid', async () => {
    createService.create.mockRejectedValue(new UnauthorizedException('Invalid job key'))

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'wrong-key')
      .expect(401)
  })

  it('returns 401 when the get job key is invalid', async () => {
    statusService.getStatus.mockRejectedValue(new UnauthorizedException('Invalid job key'))

    await request(app.getHttpServer())
      .get('/internal/jobs/kpis/refresh/41')
      .set('X-Job-Key', 'wrong-key')
      .expect(401)
  })

  it('returns 404 when the slug is unknown', async () => {
    createService.create.mockRejectedValue(new NotFoundException('Active tenant not found'))

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=missing&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(404)
  })

  it('returns 409 when the tenant backend client is misconfigured', async () => {
    createService.create.mockRejectedValue(new ConflictException('Tenant backend client is not configured'))

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(409)
  })

  it('returns 400 for invalid query params', async () => {
    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-07&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(400)

    expect(createService.create).not.toHaveBeenCalled()
  })

  it('returns 404 when the job id does not exist', async () => {
    statusService.getStatus.mockRejectedValue(new NotFoundException('Refresh job not found'))

    await request(app.getHttpServer())
      .get('/internal/jobs/kpis/refresh/999')
      .set('X-Job-Key', 'job-secret')
      .expect(404)
  })
})
