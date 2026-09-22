import { type HttpClient, HttpError } from '@vidya/client'
import { asId, type SchoolId } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { useSyncRuns } from '@/shared/sync'

import { useLeaveSchool } from '../model'

const SCHOOL = asId<SchoolId>('school-1')

const fakeHttp = () => ({ delete: vi.fn() })

const start = (http: ReturnType<typeof fakeHttp>) => {
  let leaving!: ReturnType<typeof useLeaveSchool>

  mount(
    defineComponent({
      setup() {
        leaving = useLeaveSchool()
        return () => null
      },
    }),
    { global: { provide: { [httpClientKey as symbol]: http as unknown as HttpClient } } },
  )

  return leaving
}

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn(asId('user-1'))
}

describe('leaving a school', () => {
  let runs = 0

  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    runs = 0
    useSyncRuns().adoptRunner(() => {
      runs += 1
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('asks the server to take the membership back, for oneself and no one else', async () => {
    const http = fakeHttp()
    http.delete.mockResolvedValue(undefined)
    signIn()

    await start(http).leave(SCHOOL)

    expect(http.delete).toHaveBeenCalledWith('/edu/users/user-1/schools/school-1')
  })

  it('asks for a run, so what the departure revoked comes back now', async () => {
    const http = fakeHttp()
    http.delete.mockResolvedValue(undefined)
    signIn()

    const leaving = start(http)
    await leaving.leave(SCHOOL)

    expect(leaving.stage.value).toBe('left')
    expect(runs).toBe(1)
  })

  it('says an owner cannot leave their own school rather than that something went wrong', async () => {
    const http = fakeHttp()
    http.delete.mockRejectedValue(new HttpError(409, '/edu/users/user-1/schools/school-1'))
    signIn()

    const leaving = start(http)
    await leaving.leave(SCHOOL)

    expect(leaving.stage.value).toBe('owner')
    expect(runs).toBe(0)
  })

  it('says a refusal it cannot explain is a refusal it cannot explain', async () => {
    const http = fakeHttp()
    http.delete.mockRejectedValue(new HttpError(500, '/edu/users/user-1/schools/school-1'))
    signIn()

    const leaving = start(http)
    await leaving.leave(SCHOOL)

    expect(leaving.stage.value).toBe('failed')
  })

  it('asks nothing at all while nobody is signed in', async () => {
    const http = fakeHttp()

    const leaving = start(http)
    await leaving.leave(SCHOOL)

    expect(http.delete).not.toHaveBeenCalled()
    expect(leaving.stage.value).toBe('idle')
  })

  it('leaves once, however many times the button is pressed', async () => {
    const http = fakeHttp()
    http.delete.mockResolvedValue(undefined)
    signIn()

    const leaving = start(http)
    await Promise.all([leaving.leave(SCHOOL), leaving.leave(SCHOOL)])

    expect(http.delete).toHaveBeenCalledTimes(1)
  })
})
