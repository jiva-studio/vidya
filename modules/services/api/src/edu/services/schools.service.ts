import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { SCHOOL_CODE_LENGTH, schoolCodeAlphabet } from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { randomInt } from 'crypto'
import { In, Repository } from 'typeorm'

import { Scope, ScopedEntitiesService } from './entities.service'

// Six characters out of thirty-two collide often enough for a retry to be an
// ordinary outcome; past this many the alphabet, not the draw, is the problem.
const CODE_ATTEMPTS = 8

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

      // No scope means no access, so the empty list is a deliberate fail-closed result.
      return scopes.length > 0
        ? {
            where: scopes.map((s) => ({
              ...query?.where,
              id: s.schoolId,
            })),
          }
        : { where: { id: In([]) } }
    })
  }

  /**
   * The code a school hands out, created once and then kept.
   *
   * Drawn and retried rather than derived from the name: a derived code would
   * leak a rename into every poster already printed.
   */
  async createCode(school: School): Promise<string> {
    if (school.code) return school.code

    // Joining assigns the school's default student role. Without one the first
    // visitor to the link would be met by a failure, so no link is handed out.
    if (!school.config?.defaultStudentRoleId) {
      throw new ConflictException('School has no default student role and takes no students yet')
    }

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = this.generateCode()
      if (await this.repository.existsBy({ code })) continue

      await this.repository.update({ id: school.id }, { code })
      return code
    }

    throw new Error(`Could not create a free code for school ${school.id}`)
  }

  private generateCode(): string {
    const alphabet = schoolCodeAlphabet()
    let code = ''
    for (let i = 0; i < SCHOOL_CODE_LENGTH; i++) code += alphabet[randomInt(alphabet.length)]
    return code
  }
}
