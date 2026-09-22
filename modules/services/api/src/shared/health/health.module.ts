import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { RedisService } from '../services/redis.service'
import { HealthController } from './health.controller'

@Module({
  imports: [TypeOrmModule],
  controllers: [HealthController],
  providers: [RedisService],
})
export class HealthModule {}
