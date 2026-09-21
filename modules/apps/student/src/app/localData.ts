import { createSqlSchoolRepository, type IDatabase, type ISchoolRepository } from '@vidya/client'

import { useConnection } from '@/shared/connection'

/**
 * The local reads the screens are given, bound to whoever is signed in.
 *
 * The identity is read per call rather than captured: it appears when somebody
 * signs in, long after this is built, and every row of the database is keyed
 * by it. A repository holding the empty owner would answer every screen with
 * nothing and look exactly like a school that has not arrived.
 */
export const schoolsOf = (db: IDatabase): ISchoolRepository =>
  createSqlSchoolRepository({
    db,
    ownerId: () => useConnection().connection.value?.ownerId ?? '',
  })
