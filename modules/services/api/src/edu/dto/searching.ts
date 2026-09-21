import { FindOptionsWhere, ILike } from 'typeorm'

/**
 * `%` and `_` are what the operator typed, not what they meant.
 *
 * A backslash is Postgres's default escape for `LIKE`, so no `ESCAPE` clause
 * is needed — which is as well, since this TypeORM's `ILike` takes none.
 */
const literally = (term: string): string => term.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * A name search as a `where` fragment, or nothing when none was asked for.
 *
 * One column: the scope functions refuse an array `where`, and matching a
 * second needs one. The cast is the price of a fragment that fits every
 * entity with a name; `FindOptionsWhere` cannot express a partial of itself.
 */
export const matchingName = <TEntity extends { name: string }>(
  query?: string,
): FindOptionsWhere<TEntity> => {
  const term = query?.trim()
  if (!term) return {} as FindOptionsWhere<TEntity>

  return { name: ILike(`%${literally(term)}%`) } as FindOptionsWhere<TEntity>
}
