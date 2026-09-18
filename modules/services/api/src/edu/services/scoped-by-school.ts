import { PermissionKey } from '@vidya/domain'
import { FindManyOptions, In } from 'typeorm'

import { Scope } from './entities.service'

/**
 * The scope every school-owned entity uses.
 *
 * Each table carries `schoolId`, so narrowing a query to what the caller may see
 * is the same operation everywhere: intersect the schools the query asked for
 * with the schools the caller holds the permission in. No match means no rows —
 * never all rows, which is the failure mode this shape exists to prevent.
 */
export const scopedBySchool =
  <TEntity extends { schoolId: string }>(permission: PermissionKey) =>
  (query: FindManyOptions<TEntity>, scope: Scope): FindManyOptions<TEntity> => {
    // FindOptionsWhere<TEntity> does not surface the entity's own fields here,
    // so the cast is how we read back what the caller asked for.
    const requested = (query?.where as { schoolId?: string })?.schoolId

    const scopes = scope.permissions
      .getScopes([permission])
      .filter((s) => !requested || s.schoolId === requested)

    if (scopes.length === 0) {
      return { where: { schoolId: In([]) } } as FindManyOptions<TEntity>
    }

    return {
      where: scopes.map((s) => ({ ...query?.where, schoolId: s.schoolId })),
    } as FindManyOptions<TEntity>
  }
