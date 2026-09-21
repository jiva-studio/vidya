import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { PERMISSIONS_CACHE_EVICTION, PermissionsCacheEviction } from '@vidya/api/edu/ports'
import { AuditLogService } from '@vidya/api/shared/services'
import * as domain from '@vidya/domain'
import { Role, UserRole } from '@vidya/entities'
import { DeepPartial, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm'

import { EnrollmentsService } from './enrollments.service'
import { Scope, ScopedEntitiesService } from './entities.service'

/**
 * The keys through which a role reaches the school's storage credentials.
 *
 * `'*'` is returned as itself rather than expanded: it opens the storage
 * whole, and the trail has to name what was actually handed over.
 */
const storageAccessIn = (
  permissions: readonly domain.PermissionKey[] = [],
): domain.PermissionKey[] =>
  permissions.includes('*') ? ['*'] : permissions.filter((key) => key.startsWith('storage:'))

@Injectable()
export class RolesService extends ScopedEntitiesService<Role, Scope> {
  constructor(
    @InjectRepository(Role) repository: Repository<Role>,
    @InjectRepository(UserRole) private userRolesRepo: Repository<UserRole>,
    private readonly enrollments: EnrollmentsService,
    @Inject(PERMISSIONS_CACHE_EVICTION) private readonly permissionsCache: PermissionsCacheEviction,
    private readonly auditLog: AuditLogService,
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

  /**
   * Creates a role and records who created it.
   *
   * No holder can exist yet, so there is nothing to evict and nothing to wrap
   * in a transaction of its own — the audit write is fire-and-forget here,
   * the same way an authentication event is, rather than inventing a
   * transaction whose only purpose would be to cover the audit call.
   */
  async create(request: DeepPartial<Role>, actorUserId?: domain.UserId | null): Promise<Role> {
    const role = await super.create(request)

    await this.auditLog.record({
      action: 'edu.role.created',
      actorUserId: actorUserId ?? null,
      subjectType: 'role',
      subjectId: role.id,
      schoolId: role.schoolId,
      payload: { name: role.name, permissions: role.permissions },
    })

    await this.recordStorageGrant(role, storageAccessIn(role.permissions), actorUserId)

    return role
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
    actorUserId?: domain.UserId | null,
  ): Promise<void> {
    await this.assertRolesWithin(roleIds, schoolIds)

    const elsewhere = (await this.getRolesOfUser(userId))
      .filter((role) => !schoolIds.includes(role.schoolId))
      .map((role) => role.id)

    await this.setRolesForUser(userId, [...elsewhere, ...roleIds], actorUserId)
  }

  async setRolesForUser(
    userId: domain.UserId,
    roleIds: domain.RoleId[],
    actorUserId?: domain.UserId | null,
  ): Promise<void> {
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

      // Last statement in the transaction, same shape as the membership close
      // above: a throw earlier in this callback skips it, so a rolled-back
      // change never evicts. Redis has no part in the Postgres transaction
      // though, so this still runs before the surrounding COMMIT actually
      // lands — if the process dies in that narrow gap, the entry is evicted
      // for a change that never became durable. The next read just re-derives
      // permissions from the (unchanged) database, so that failure mode is a
      // wasted recompute, never a stale grant.
      if (rolesToAssign.length > 0 || rolesToRemove.length > 0) {
        await this.permissionsCache.evict([userId])
      }

      // Audited on the same manager as the rest of this callback, so a throw
      // above — including inside the eviction — leaves no row behind either.
      await this.recordRoleAssignmentChanges(
        transactionalEntityManager,
        userId,
        rolesToAssign,
        rolesToRemove.map((userRole) => userRole.roleId),
        actorUserId,
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
  async deleteOneBy(
    query: FindOptionsWhere<Role>,
    actorUserId?: domain.UserId | null,
  ): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      const role = await manager.findOneBy(Role, query)

      if (!role) return

      // Captured before `remove` — TypeORM clears an entity's primary key
      // once it has been removed, and the audit entry below is written after.
      const roleId = role.id

      const holders = (await manager.findBy(UserRole, { roleId: role.id })).map(
        (userRole) => userRole.userId,
      )

      await manager.remove(role)

      for (const holder of holders) {
        await this.closeMembershipIfEnded(manager, holder, role.schoolId)
      }

      // The one query above already has every holder; evicting from that list
      // rather than querying again keeps this at one query, not N. Positioned
      // last for the same reason `setRolesForUser` places its eviction last —
      // see the comment there for the honest limit on how "inside the
      // transaction" is read when the cache is not.
      if (holders.length > 0) {
        await this.permissionsCache.evict(holders)
      }

      // One entry per holder — a role deletion is really "each of these
      // people lost this access", which is the question this table exists to
      // answer. Written on the same manager, so a throw anywhere above —
      // including the eviction — leaves none of them behind.
      for (const holder of holders) {
        await this.auditLog.record(
          {
            action: 'edu.role.deleted',
            actorUserId: actorUserId ?? null,
            subjectType: 'user',
            subjectId: holder,
            schoolId: role.schoolId,
            payload: { roleId, roleName: role.name },
          },
          manager,
        )
      }
    })
  }

  /**
   * Updates a role, and forgets the cached permissions of everyone who holds
   * it.
   *
   * Overridden rather than inherited from `EntitiesService.updateOneBy`
   * because a role's permissions are a fact about every user who holds it, not
   * about the row alone — and the base method, shared by every other entity in
   * this hierarchy, has no business knowing that.
   */
  async updateOneBy(
    query: FindOptionsWhere<Role>,
    request: DeepPartial<Role>,
    actorUserId?: domain.UserId | null,
  ): Promise<Role> {
    return await this.repository.manager.transaction(async (manager) => {
      const entity = await manager.findOneBy(Role, query)
      const held = storageAccessIn(entity?.permissions)
      const updated = await manager.save(Role, manager.merge(Role, entity, request))

      const holders = (await manager.findBy(UserRole, { roleId: updated.id })).map(
        (userRole) => userRole.userId,
      )

      // Same shape and the same honest limit as `deleteOneBy`: one query for
      // every holder, evicted last, and safe against a crash in the tiny gap
      // before Redis and the transaction's COMMIT ever agree.
      if (holders.length > 0) {
        await this.permissionsCache.evict(holders)
      }

      // Only when the request actually touched permissions — a name or
      // description edit is not the event this table exists to answer.
      if (request.permissions !== undefined) {
        await this.auditLog.record(
          {
            action: 'edu.role.permissionsUpdated',
            actorUserId: actorUserId ?? null,
            subjectType: 'role',
            subjectId: updated.id,
            schoolId: updated.schoolId,
            payload: { permissions: updated.permissions },
          },
          manager,
        )
      }

      await this.recordStorageGrant(
        updated,
        storageAccessIn(updated.permissions).filter((key) => !held.includes(key)),
        actorUserId,
        manager,
      )

      return updated
    })
  }

  /**
   * Says that a role may now reach the school's storage credentials.
   *
   * Only the role gaining the key is the event: handing an existing role to a
   * person is already `edu.role.assigned`. The payload names the keys and
   * nothing about the credentials themselves.
   */
  private async recordStorageGrant(
    role: Role,
    grantedKeys: domain.PermissionKey[],
    actorUserId: domain.UserId | null | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    if (grantedKeys.length === 0) return

    await this.auditLog.record(
      {
        action: 'media.role.storageGranted',
        actorUserId: actorUserId ?? null,
        subjectType: 'role',
        subjectId: role.id,
        schoolId: role.schoolId,
        payload: { granted: grantedKeys },
      },
      manager,
    )
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

  /**
   * One entry per role assigned and per role removed — `setRolesForUser`
   * replaces a set, but "what did this user reach, and for how long" needs
   * the individual grants and revocations, not the set's before/after.
   */
  private async recordRoleAssignmentChanges(
    manager: EntityManager,
    userId: domain.UserId,
    assignedRoleIds: domain.RoleId[],
    removedRoleIds: domain.RoleId[],
    actorUserId: domain.UserId | null | undefined,
  ): Promise<void> {
    const touchedRoleIds = [...assignedRoleIds, ...removedRoleIds]
    if (touchedRoleIds.length === 0) return

    const roles = await manager.find(Role, { where: { id: In(touchedRoleIds) } })
    const schoolIdOf = new Map(roles.map((role) => [role.id, role.schoolId]))

    const entries = [
      ...assignedRoleIds.map((roleId) => ({ action: 'edu.role.assigned' as const, roleId })),
      ...removedRoleIds.map((roleId) => ({ action: 'edu.role.removed' as const, roleId })),
    ]

    for (const { action, roleId } of entries) {
      await this.auditLog.record(
        {
          action,
          actorUserId: actorUserId ?? null,
          subjectType: 'user',
          subjectId: userId,
          schoolId: schoolIdOf.get(roleId) ?? null,
          payload: { roleId },
        },
        manager,
      )
    }
  }
}
