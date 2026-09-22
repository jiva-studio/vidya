import type { IDatabase } from '@vidya/client'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConnection } from '@/shared/connection'

import { schoolsOf } from '../localData'

const fakeDatabase = () => {
  const params: unknown[][] = []

  const db = {
    query: async (_sql: string, values: unknown[] = []) => {
      params.push(values)
      return []
    },
  } as unknown as IDatabase

  return { db, params }
}

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('user-1' as never)
}

/**
 * The reads a screen is given are the signed-in student's reads. The identity
 * appears long after the repository is built, so it has to be read per call.
 */
describe('the local reads handed to the screens', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
  })

  it('reads under whoever is signed in at the time of the read', async () => {
    const { db, params } = fakeDatabase()
    const schools = schoolsOf(db)

    signIn()
    await schools.list()

    expect(params[0]).toContain('user-1')
  })

  it('names no owner at all while nobody is signed in', async () => {
    const { db, params } = fakeDatabase()

    await schoolsOf(db).list()

    expect(params[0]).toContain('')
  })
})
