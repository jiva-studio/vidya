import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Lesson } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class LessonsService extends ScopedEntitiesService<Lesson, Scope> {
  constructor(@InjectRepository(Lesson) repository: Repository<Lesson>) {
    super(repository, scopedBySchool<Lesson>('lessons:read'))
  }
}
