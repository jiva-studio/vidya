import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Enrollment, Group } from '@vidya/entities'
import { FindOptionsWhere, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'
import { scopedBySchool } from './scoped-by-school'

@Injectable()
export class GroupsService extends ScopedEntitiesService<Group, Scope> {
  constructor(@InjectRepository(Group) repository: Repository<Group>) {
    super(repository, scopedBySchool<Group>('groups:read'))
  }

  /**
   * Removes a group, and the wishes that pointed at it with it.
   *
   * The requests are saved one at a time and before the group goes, rather than
   * left to a cascade: the journal is written by an entity subscriber, so a
   * cascade would clear the column inside the database and no device would ever
   * be told the group it asked for had gone.
   *
   * Nothing in the database ties the two halves together, so the transaction
   * does: a group that survives its removal must leave every wish for it, and
   * every journal row about one, exactly where they were.
   */
  async deleteOneBy(query: FindOptionsWhere<Group>): Promise<void> {
    const group = await this.repository.findOneBy(query)

    if (!group) return

    await this.repository.manager.transaction(async (manager) => {
      const asked = await manager.findBy(Enrollment, { preferredGroupId: group.id })

      for (const request of asked) {
        request.preferredGroupId = null
        await manager.save(request)
      }

      await manager.remove(group)
    })
  }
}
