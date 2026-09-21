import { Controller, Get, HttpStatus, Optional, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { InjectDataSource } from '@nestjs/typeorm'
import type { Response } from 'express'
import { DataSource } from 'typeorm'

import { RedisService } from '../services/redis.service'

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> => {
  let timer: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Healthcheck operation timed out')), timeoutMs)
    timer.unref?.()
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  getLiveness(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async getReadiness(@Res() res: Response): Promise<void> {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
      redis: 'down',
    }

    let isDbHealthy = false
    let isRedisHealthy = false

    try {
      await withTimeout(this.dataSource.query('SELECT 1'))
      checks.database = 'up'
      isDbHealthy = true
    } catch {
      checks.database = 'down'
    }

    if (this.redisService) {
      try {
        await withTimeout(this.redisService.ping())
        checks.redis = 'up'
        isRedisHealthy = true
      } catch {
        checks.redis = 'down'
      }
    } else {
      checks.redis = 'up'
      isRedisHealthy = true
    }

    const allHealthy = isDbHealthy && isRedisHealthy
    const statusCode = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE

    res.status(statusCode).json({
      status: allHealthy ? 'ok' : 'down',
      checks,
      timestamp: new Date().toISOString(),
    })
  }
}
