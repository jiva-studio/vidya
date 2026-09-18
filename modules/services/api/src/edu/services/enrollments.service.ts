import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Enrollment } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class EnrollmentsService extends ScopedEntitiesService<Enrollment, Scope> {
  constructor(@InjectRepository(Enrollment) repository: Repository<Enrollment>) {
    super(repository, scopedBySchool<Enrollment>('enrollments:read'))
  }
}
