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
  const cleanup = () => clearTimeout(timer)
  return Promise.race([promise, timeoutPromise]).finally(cleanup)
}

const checkDatabase = async (dataSource: DataSource): Promise<'up' | 'down'> => {
  try {
    await withTimeout(dataSource.query('SELECT 1'))
    return 'up'
  } catch {
    return 'down'
  }
}

const checkRedis = async (redisService?: RedisService): Promise<'up' | 'down'> => {
  if (!redisService) return 'up'
  try {
    await withTimeout(redisService.ping())
    return 'up'
  } catch {
    return 'down'
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
    const database = await checkDatabase(this.dataSource)
    const redis = await checkRedis(this.redisService)

    const allHealthy = database === 'up' && redis === 'up'
    const statusCode = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE

    res.status(statusCode).json({
      status: allHealthy ? 'ok' : 'down',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    })
  }
}
