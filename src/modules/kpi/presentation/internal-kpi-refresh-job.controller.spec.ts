import { ConflictException, INestApplication, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { InternalKpiRefreshJobService } from '../application/internal-kpi-refresh-job.service'
import { InternalKpiRefreshJobController } from './internal-kpi-refresh-job.controller'

describe('InternalKpiRefreshJobController', () => {
  let app: INestApplication
  const service = {
    run: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalKpiRefreshJobController],
      providers: [
        {
          provide: InternalKpiRefreshJobService,
          useValue: service,
        },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 without Authorization or X-Tenant-Id when the job runs', async () => {
    service.run.mockResolvedValue({
      slug: 'ferracosul-kpi-dev',
      clientId: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
      overallStatus: 'success',
      results: [],
    })

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(200)
      .expect({
        slug: 'ferracosul-kpi-dev',
        clientId: 'ferracosul',
        from: '2026-04-01',
        to: '2026-04-06',
        overallStatus: 'success',
        results: [],
      })

    expect(service.run).toHaveBeenCalledWith({
      jobKey: 'job-secret',
      slug: 'ferracosul-kpi-dev',
      from: '2026-04-01',
      to: '2026-04-06',
    })
  })

  it('returns 401 when the X-Job-Key header is missing', async () => {
    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .expect(401)

    expect(service.run).not.toHaveBeenCalled()
  })

  it('returns 401 when the job key is invalid', async () => {
    service.run.mockRejectedValue(new UnauthorizedException('Invalid job key'))

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'wrong-key')
      .expect(401)
  })

  it('returns 404 when the slug is unknown', async () => {
    service.run.mockRejectedValue(new NotFoundException('Active tenant not found'))

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=missing&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(404)
  })

  it('returns 409 when the tenant backend client is misconfigured', async () => {
    service.run.mockRejectedValue(new ConflictException('Tenant backend client is not configured'))

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

    expect(service.run).not.toHaveBeenCalled()
  })

  it('returns 200 when the job completes with partial failures', async () => {
    service.run.mockResolvedValue({
      slug: 'ferracosul-kpi-dev',
      clientId: 'ferracosul',
      from: '2026-04-01',
      to: '2026-04-06',
      overallStatus: 'partial_success',
      results: [
        {
          job: 'budgets',
          status: 'failed',
          startedAt: '2026-04-06T17:00:00.000Z',
          finishedAt: '2026-04-06T17:00:01.000Z',
          error: 'Budget refresh failed',
        },
      ],
    })

    await request(app.getHttpServer())
      .post('/internal/jobs/kpis/refresh?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-06')
      .set('X-Job-Key', 'job-secret')
      .expect(200)
      .expect((response) => {
        expect(response.body.overallStatus).toBe('partial_success')
      })
  })
})
