import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessonVersion } from '@vidya/entities'
import { Repository } from 'typeorm'

import { EntitiesService } from './entities.service'

/**
 * Versions are reached through their lesson, which is what carries the school,
 * so this service is unscoped by design: the caller has already proven access to
 * the lesson before it asks for a version.
 */
@Injectable()
export class LessonVersionsService extends EntitiesService<LessonVersion> {
  constructor(@InjectRepository(LessonVersion) repository: Repository<LessonVersion>) {
    super(repository)
  }
}
