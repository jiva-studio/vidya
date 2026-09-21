import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as domain from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { In, Repository } from 'typeorm'

import { RolesService } from './roles.service'

/**
 * Refused rather than failed: a school whose settings name no role for a new
 * student, or name one that has since been deleted, cannot take anyone. The
 * same answer the code route gives, so a link and the join behind it agree.
 */
export const NO_STUDENT_ROLE = 'The school is not accepting students yet'

@Injectable()
export class UserSchoolsService {
  constructor(
    @InjectRepository(School) private readonly schools: Repository<School>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Get all schools the user is associated with
   * @param userId User ID to get schools for
   * @returns List of school IDs the user is associated with
   */
  async getUserSchools(userId: domain.UserId): Promise<domain.SchoolId[]> {
    // get user by id with all roles
    const user = await this.users.findOneOrFail({
      where: { id: userId },
      relations: ['roles'],
    })
    const allUserRolesId = user.roles.map((role) => role.id)

    const schoolRoles = await this.roles.find({
      where: { id: In(allUserRolesId) },
    })

    return schoolRoles.map((role) => role.schoolId)
  }

  /**
   * Add a user to a school
   * @param userId User to add to school to
   * @param schoolId School to add user to
   */
  async addUser(userId: domain.UserId, schoolId: domain.SchoolId): Promise<void> {
    await this.schools.manager.transaction(async (transactionalEntityManager) => {
      const school = await transactionalEntityManager.findOneByOrFail(School, { id: schoolId })
      const user = await transactionalEntityManager.findOneOrFail(User, {
        where: { id: userId },
        relations: ['roles'],
      })
      const studentDefaultRole = school.config.defaultStudentRoleId
        ? await transactionalEntityManager.findOneBy(Role, {
            id: school.config.defaultStudentRoleId,
          })
        : null

      if (!studentDefaultRole) {
        throw new ConflictException(NO_STUDENT_ROLE)
      }

      user.roles.push(studentDefaultRole)
      await transactionalEntityManager.save(user)
    })
  }

  /**
   * Take a user's membership of one school back.
   *
   * The work is `RolesService`'s, and deliberately so: taking a role away is
   * what ends a membership, and it happens from several places. A second
   * implementation here would be a second place to forget that the places the
   * role carried go with it.
   */
  async removeUser(
    userId: domain.UserId,
    schoolId: domain.SchoolId,
    actorUserId?: domain.UserId | null,
  ): Promise<void> {
    await this.rolesService.setRolesForUserWithin(userId, [], [schoolId], actorUserId)
  }
}
