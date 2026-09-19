import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as domain from '@vidya/domain'
import { Enrollment, Role, School, User } from '@vidya/entities'
import { EntityManager, In, Repository } from 'typeorm'

/** The places a revocation takes back; a refusal was never a place to begin with. */
const REVOCABLE: domain.EnrollmentStatus[] = ['pending', 'accepted']

@Injectable()
export class UserSchoolsService {
  constructor(
    @InjectRepository(School) private readonly schools: Repository<School>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(User) private readonly users: Repository<User>,
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
      const studentDefaultRole = await transactionalEntityManager.findOneByOrFail(Role, {
        id: school.config.defaultStudentRoleId,
      })
      user.roles.push(studentDefaultRole)
      await transactionalEntityManager.save(user)
    })
  }

  /**
   * Take a user's membership of a school back, and everything it carried.
   *
   * A place on a course of the school outlives the role that granted it only on
   * paper: the student would keep receiving its lessons with no school to hold
   * them. So the roles and the enrolments go together, in one transaction —
   * either the person is out of the school or nothing moved.
   */
  async removeUser(userId: domain.UserId, schoolId: domain.SchoolId): Promise<void> {
    await this.schools.manager.transaction(async (manager) => {
      await this.revokeRoles(manager, userId, schoolId)
      await this.revokePlaces(manager, userId, schoolId)
    })
  }

  private async revokeRoles(
    manager: EntityManager,
    userId: domain.UserId,
    schoolId: domain.SchoolId,
  ): Promise<void> {
    const user = await manager.findOneOrFail(User, { where: { id: userId }, relations: ['roles'] })

    user.roles = user.roles.filter((role) => role.schoolId !== schoolId)
    await manager.save(user)
  }

  /**
   * Saved one entity at a time on purpose: a bulk `UPDATE` moves the rows and
   * reaches no device, because the journal is written by an entity subscriber
   * and SQL that goes round it leaves the scope cursor walking past nothing.
   */
  private async revokePlaces(
    manager: EntityManager,
    userId: domain.UserId,
    schoolId: domain.SchoolId,
  ): Promise<void> {
    const places = await manager.findBy(Enrollment, {
      studentId: userId,
      schoolId,
      status: In(REVOCABLE),
    })

    for (const place of places) {
      place.status = 'revoked'
      await manager.save(place)
    }
  }
}
