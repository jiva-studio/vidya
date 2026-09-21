import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { SCHOOL_CODE_LENGTH, schoolCodeAlphabet } from '@vidya/domain'
import { Role, School, User } from '@vidya/entities'
import { randomInt } from 'crypto'
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
   * The code a school hands out, minted once and then kept.
   *
   * Retried rather than computed from the name: the alphabet is small enough
   * that a collision is ordinary, and a code derived from the name would leak
   * a rename into every poster already printed.
   */
  async mintCode(school: School): Promise<string> {
    if (school.code) return school.code

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateCode()
      const taken = await this.repository.findOneBy({ code })
      if (taken) continue

      await this.repository.update({ id: school.id }, { code })
      return code
    }

    throw new Error(`could not mint a free code for school ${school.id}`)
  }

  private generateCode(): string {
    const alphabet = schoolCodeAlphabet()
    let code = ''
    for (let i = 0; i < SCHOOL_CODE_LENGTH; i++) code += alphabet[randomInt(alphabet.length)]
    return code
  }
}
