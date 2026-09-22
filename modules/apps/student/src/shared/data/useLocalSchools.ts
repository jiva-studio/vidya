import type { ISchoolRepository } from '@vidya/client'
import { inject, type InjectionKey } from 'vue'

/**
 * How a screen reads the schools this machine holds.
 *
 * The repository is built in the composition root, over the one database the
 * tab opened. Everything a school contains arrives through synchronisation, so
 * a screen asking "which schools am I in" is asking the local database and
 * never the server: the answer has to be the same one the lists are drawn
 * from, or an empty screen and an empty membership would disagree.
 */
export const schoolRepositoryKey: InjectionKey<ISchoolRepository> = Symbol('vidya.schools')

export const useLocalSchools = (): ISchoolRepository => {
  const schools = inject(schoolRepositoryKey, null)
  if (schools === null) throw new Error('no local schools were provided to this application')

  return schools
}
