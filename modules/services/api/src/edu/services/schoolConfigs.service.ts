import { BadRequestException, Injectable } from '@nestjs/common'
import { SchoolConfig } from '@vidya/entities'
import { In } from 'typeorm'

import { RolesService } from './roles.service'
import { SchoolsService } from './schools.service'

/**
 * A school's configuration, and the rules about what may go in it.
 *
 * The checks live here rather than in the controller because they are about the
 * school, not about HTTP: any other way in — an import, a seeder, the sync
 * endpoints — has to obey them too.
 */
@Injectable()
export class SchoolConfigsService {
  constructor(
    private readonly schools: SchoolsService,
    private readonly roles: RolesService,
  ) {}

  async update(schoolId: string, changes: Partial<SchoolConfig>): Promise<void> {
    await this.assertRolesAssignable(schoolId, changes)

    const school = await this.schools.findOneBy({ id: schoolId })

    school.config = { ...school.config, ...changes }

    await this.schools.save(school)
  }

  /**
   * A student role must belong to this school and must not be the owner role.
   *
   * Existence is already established by the IsRoleExist validation on the DTO;
   * what is checked here is whether the role may be used this way.
   */
  private async assertRolesAssignable(
    schoolId: string,
    changes: Partial<SchoolConfig>,
  ): Promise<void> {
    const ids = [
      ...(changes.defaultStudentRoleId ? [changes.defaultStudentRoleId] : []),
      ...(changes.studentRoleIds ?? []),
    ]

    if (ids.length === 0) return

    const roles = await this.roles.findAll({ where: { id: In(ids) } })

    const owner = roles.find((role) => role.permissions.includes('*'))
    if (owner) {
      throw new BadRequestException('Cannot assign owner role')
    }

    const foreign = roles.find((role) => role.schoolId !== schoolId)
    if (foreign) {
      throw new BadRequestException('Role does not belong to this school')
    }
  }
}
