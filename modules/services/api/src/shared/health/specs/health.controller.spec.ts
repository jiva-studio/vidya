import { HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { DataSource } from 'typeorm'

import { RedisService } from '../../services/redis.service'
import { HealthController } from '../health.controller'

describe('HealthController', () => {
  let controller: HealthController
  let mockDataSource: { query: jest.Mock }
  let mockRedisService: { ping: jest.Mock }
  let mockResponse: { status: jest.Mock; json: jest.Mock }

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    }
    mockRedisService = {
      ping: jest.fn().mockResolvedValue('PONG'),
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    controller = new HealthController(
      mockDataSource as unknown as DataSource,
      mockRedisService as unknown as RedisService,
    )
  })

  it('returns ok for live endpoint', () => {
    const live = controller.getLiveness()

    expect(live.status).toBe('ok')
    expect(typeof live.uptime).toBe('number')
    expect(live.timestamp).toBeDefined()
  })

  it('returns ok 200 when database and redis are healthy in readiness check', async () => {
    await controller.getReadiness(mockResponse as unknown as Response)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
      }),
    )
  })

  it('returns down 503 when database fails', async () => {
    mockDataSource.query.mockRejectedValue(new Error('Connection lost'))

    await controller.getReadiness(mockResponse as unknown as Response)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'down',
        checks: { database: 'down', redis: 'up' },
      }),
    )
  })

  it('returns down 503 when redis fails', async () => {
    mockRedisService.ping.mockRejectedValue(new Error('Redis timeout'))

    await controller.getReadiness(mockResponse as unknown as Response)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'down',
        checks: { database: 'up', redis: 'down' },
      }),
    )
  })
})
