import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Role, UserRole } from '@vidya/entities'
import { In, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'

@Injectable()
export class RolesService extends ScopedEntitiesService<Role, Scope> {
  constructor(
    @InjectRepository(Role) repository: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
  ) {
    super(repository, (query, scope) => {
      // FindOptionsWhere<Role> does not surface the entity's own fields, hence the cast.
      const { schoolId } = query?.where as any

      const scopes = scope.permissions
        .getScopes(['roles:read'])
        .filter((s) => !schoolId || s.schoolId === schoolId)

      // No scope means no access, so the empty list is a deliberate fail-closed result.
      return scopes.length > 0
        ? {
            where: scopes.map((s) => ({
              ...query?.where,
              schoolId: s.schoolId,
            })),
          }
        : { where: { schoolId: In([]) } }
    })
  }

  async getRolesOfUser(userId: string): Promise<Role[]> {
    return await this.repository
      .createQueryBuilder('role')
      .innerJoin('role.userRoles', 'userRole')
      .where('userRole.userId = :userId', { userId })
      .getMany()
  }

  async setRolesForUser(userId: string, roleIds: string[]): Promise<void> {
    const existing = await this.userRolesRepo.findBy({ userId })

    // find roles to add or remove
    const rolesToAssign = roleIds.filter(
      (roleId) => !existing.some((userRole) => userRole.roleId === roleId),
    )
    const rolesToRemove = existing.filter((userRole) => !roleIds.includes(userRole.roleId))

    // perform the changes in a single transaction
    await this.userRolesRepo.manager.transaction(async (transactionalEntityManager) => {
      await Promise.all([
        ...rolesToAssign.map(async (roleId) => {
          const userRole = this.userRolesRepo.create({ userId, roleId })
          await transactionalEntityManager.save(userRole)
        }),
        ...rolesToRemove.map(async (userRole) => {
          await transactionalEntityManager.remove(userRole)
        }),
      ])
    })
  }
}
