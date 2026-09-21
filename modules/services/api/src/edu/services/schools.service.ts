import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Role, School, User } from '@vidya/entities'
import { In, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'

@Injectable()
export class SchoolsService extends ScopedEntitiesService<School, Scope> {
  constructor(
    @InjectRepository(School) repository: Repository<School>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super(repository, (query, scope) => {
      // FindOptionsWhere<School> does not surface the entity's own fields, hence the cast.
      const where = query?.where as any

      // TODO Haven't tested yet

      const scopes = scope.permissions
        .getScopes(['schools:read'])
        .filter((s) => !where?.id || s.schoolId === where?.id)

      // No scope means no access, so the empty list is a deliberate fail-closed
      // result. Everything but `where` is carried over: a scope that rebuilt
      // the query from nothing dropped the paging and the ordering with it.
      return scopes.length > 0
        ? {
            ...query,
            where: scopes.map((s) => ({
              ...query?.where,
              id: s.schoolId,
            })),
          }
        : { ...query, where: { id: In([]) } }
    })
  }
}
