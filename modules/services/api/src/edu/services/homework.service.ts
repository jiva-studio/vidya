import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Homework } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class HomeworkService extends ScopedEntitiesService<Homework, Scope> {
  constructor(@InjectRepository(Homework) repository: Repository<Homework>) {
    super(repository, scopedBySchool<Homework>('homework:read'))
  }
}
