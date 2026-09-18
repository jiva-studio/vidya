import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Course } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class CoursesService extends ScopedEntitiesService<Course, Scope> {
  constructor(@InjectRepository(Course) repository: Repository<Course>) {
    super(repository, scopedBySchool<Course>('courses:read'))
  }
}
