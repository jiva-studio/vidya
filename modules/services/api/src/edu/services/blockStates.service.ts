import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { BlockState } from '@vidya/entities'
import { Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class BlockStatesService extends ScopedEntitiesService<BlockState, Scope> {
  constructor(@InjectRepository(BlockState) repository: Repository<BlockState>) {
    super(repository, scopedBySchool<BlockState>('homework:read'))
  }
}
