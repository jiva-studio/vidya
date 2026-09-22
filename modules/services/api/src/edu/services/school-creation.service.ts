import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { PERMISSIONS_CACHE_EVICTION, PermissionsCacheEviction } from '@vidya/api/edu/ports'
import { AuditLogService } from '@vidya/api/shared/services'
import * as domain from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { Repository } from 'typeorm'

/**
 * Keys of the role that keeps a school's storage working: enough to configure
 * the bucket and manage what sits in it, and nothing that touches the school's
 * own presentation.
 */
const TECHNICAL_SPECIALIST_PERMISSIONS: domain.PermissionKey[] = [
  'storage:read',
  'storage:update',
  'media:read',
  'media:upload',
  'media:delete',
  'schools:read',
]

@Injectable()
export class SchoolCreationService {
  constructor(
    @InjectRepository(School) private readonly schools: Repository<School>,
    @Inject(PERMISSIONS_CACHE_EVICTION) private readonly permissionsCache: PermissionsCacheEviction,
    private readonly auditLog: AuditLogService,
  ) {}

  async createNewSchool(userId: domain.UserId, params: Partial<School>): Promise<School> {
    return await this.schools.manager.transaction(async (transaction) => {
      // Create a new school
      const school = await transaction.save(School, params)

      // Create an admin role for the school
      const adminRole = await transaction.save(Role, {
        name: 'Owner',
        description: 'Owner of the school',
        schoolId: school.id,
        permissions: ['*'],
      })

      // Created alongside the owner so a school is never left with storage
      // nobody but its owner can configure.
      const technicalRole = await transaction.save(Role, {
        name: 'Technical Specialist',
        description: 'Keeps the school storage configured',
        schoolId: school.id,
        permissions: TECHNICAL_SPECIALIST_PERMISSIONS,
      })

      // Find the user
      const owner = await transaction.findOneOrFail(User, {
        where: { id: userId },
        relations: ['roles'],
      })
      owner.roles = [...(owner.roles ?? []), adminRole]
      await transaction.save(User, owner)

      // The new Owner role grants '*', so whatever this user's permissions
      // were cached as before is now wrong. Evicted last, same shape and the
      // same honest limit as `RolesService` — see its `setRolesForUser` for
      // the note on the gap between this call and the transaction's COMMIT.
      await this.permissionsCache.evict([userId])

      // Written on the same manager, so a school that never actually gets
      // created — the transaction rolls back — leaves no trace of an owner
      // grant that never happened either.
      await this.auditLog.record(
        {
          action: 'edu.school.created',
          actorUserId: userId,
          subjectType: 'school',
          subjectId: school.id,
          schoolId: school.id,
          payload: {
            ownerId: userId,
            ownerRoleId: adminRole.id,
            technicalRoleId: technicalRole.id,
          },
        },
        transaction,
      )

      // Return the created school
      return school
    })
  }
}
