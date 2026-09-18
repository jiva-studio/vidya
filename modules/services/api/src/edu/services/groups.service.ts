import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Group } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class GroupsService extends ScopedEntitiesService<Group, Scope> {
  constructor(@InjectRepository(Group) repository: Repository<Group>) {
    super(repository, scopedBySchool<Group>('groups:read'))
  }
}
