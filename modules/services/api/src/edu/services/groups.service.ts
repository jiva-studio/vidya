import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Enrollment, Group } from '@vidya/entities'
import { FindOptionsWhere, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class GroupsService extends ScopedEntitiesService<Group, Scope> {
  constructor(
    @InjectRepository(Group) repository: Repository<Group>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
  ) {
    super(repository, scopedBySchool<Group>('groups:read'))
  }

  /**
   * Removes a group, and the wishes that pointed at it with it.
   *
   * The requests are saved one at a time and before the group goes, rather than
   * left to a cascade: the journal is written by an entity subscriber, so a
   * cascade would clear the column inside the database and no device would ever
   * be told the group it asked for had gone.
   */
  async deleteOneBy(query: FindOptionsWhere<Group>): Promise<void> {
    const group = await this.repository.findOneBy(query)

    if (!group) return

    const asked = await this.enrollments.findBy({ preferredGroupId: group.id })

    for (const request of asked) {
      request.preferredGroupId = null
      await this.enrollments.save(request)
    }

    await this.repository.remove(group)
  }
}
