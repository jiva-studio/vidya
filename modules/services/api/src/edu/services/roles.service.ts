import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as domain from '@vidya/domain'
import { Role, UserRole } from '@vidya/entities'
import { EntityManager, FindOptionsWhere, In, Repository } from 'typeorm'

import { EnrollmentsService } from './enrollments.service'
import { Scope, ScopedEntitiesService } from './entities.service'

@Injectable()
export class RolesService extends ScopedEntitiesService<Role, Scope> {
  constructor(
    @InjectRepository(Role) repository: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    private readonly enrollments: EnrollmentsService,
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

  async getRolesOfUser(userId: domain.UserId): Promise<Role[]> {
    return await this.repository
      .createQueryBuilder('role')
      .innerJoin('role.userRoles', 'userRole')
      .where('userRole.userId = :userId', { userId })
      .getMany()
  }

  /**
   * The user's roles, limited to schools the caller may look into.
   *
   * A user can hold roles in several schools, and an administrator of one is
   * not entitled to learn where else that person works.
   */
  async getRolesOfUserWithin(userId: domain.UserId, schoolIds: domain.SchoolId[]): Promise<Role[]> {
    const roles = await this.getRolesOfUser(userId)
    return roles.filter((role) => schoolIds.includes(role.schoolId))
  }

  /**
   * Refuses unless every role named belongs to one of the given schools.
   *
   * The rule lives here rather than in the controller so that the next caller
   * in — the offline sync endpoints do not go through one — gets it too.
   */
  async assertRolesWithin(roleIds: domain.RoleId[], schoolIds: domain.SchoolId[]): Promise<void> {
    if (roleIds.length === 0) return

    const roles = await this.repository.find({ where: { id: In(roleIds) } })
    const allFound = roles.length === new Set(roleIds).size
    const allInScope = roles.every((role) => schoolIds.includes(role.schoolId))

    if (!allFound || !allInScope) {
      throw new ForbiddenException('User does not have permission')
    }
  }

  /**
   * Replaces the user's roles inside the given schools, leaving every other
   * school alone.
   *
   * Replacing the whole set would let an administrator of one school strip a
   * person of the roles they hold somewhere else, simply by saving a form.
   */
  async setRolesForUserWithin(
    userId: domain.UserId,
    roleIds: domain.RoleId[],
    schoolIds: domain.SchoolId[],
  ): Promise<void> {
    await this.assertRolesWithin(roleIds, schoolIds)

    const elsewhere = (await this.getRolesOfUser(userId))
      .filter((role) => !schoolIds.includes(role.schoolId))
      .map((role) => role.id)

    await this.setRolesForUser(userId, [...elsewhere, ...roleIds])
  }

  async setRolesForUser(userId: domain.UserId, roleIds: domain.RoleId[]): Promise<void> {
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

      await this.closeMembershipsEnded(
        transactionalEntityManager,
        userId,
        rolesToRemove.map((userRole) => userRole.roleId),
        roleIds,
      )
    })
  }

  /**
   * Deletes a role, and lets go of everyone it was the last thing holding.
   *
   * Overridden rather than inherited because the row does not go alone: the
   * database cascades the role off its holders, and a holder left with nothing
   * in that school has stopped belonging to it.
   */
  async deleteOneBy(query: FindOptionsWhere<Role>): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      const role = await manager.findOneBy(Role, query)

      if (!role) return

      const holders = (await manager.findBy(UserRole, { roleId: role.id })).map(
        (userRole) => userRole.userId,
      )

      await manager.remove(role)

      for (const holder of holders) {
        await this.closeMembershipIfEnded(manager, holder, role.schoolId)
      }
    })
  }

  /**
   * The cascade that keeps `scopesFor` honest: a place on a course is a
   * consequence of belonging to the school, and every path that takes the last
   * role away has to come through here. A path that forgets it leaves a student
   * reading the school's catalogue and lessons on a role nobody has.
   */
  private async closeMembershipsEnded(
    manager: EntityManager,
    userId: domain.UserId,
    removedRoleIds: domain.RoleId[],
    keptRoleIds: domain.RoleId[],
  ): Promise<void> {
    if (removedRoleIds.length === 0) return

    const removed = await manager.find(Role, { where: { id: In(removedRoleIds) } })
    const kept = keptRoleIds.length
      ? await manager.find(Role, { where: { id: In(keptRoleIds) } })
      : []

    const stillIn = new Set(kept.map((role) => role.schoolId))
    const left = new Set(removed.map((role) => role.schoolId))

    for (const schoolId of left) {
      if (!stillIn.has(schoolId)) {
        await this.enrollments.revokePlacesIn(userId, schoolId, manager)
      }
    }
  }

  /** The same, for a path that knows one school and has to ask about the rest. */
  private async closeMembershipIfEnded(
    manager: EntityManager,
    userId: domain.UserId,
    schoolId: domain.SchoolId,
  ): Promise<void> {
    const remaining = await manager
      .createQueryBuilder(Role, 'role')
      .innerJoin('role.userRoles', 'userRole')
      .where('userRole.userId = :userId', { userId })
      .andWhere('role.schoolId = :schoolId', { schoolId })
      .getCount()

    if (remaining === 0) {
      await this.enrollments.revokePlacesIn(userId, schoolId, manager)
    }
  }
}
