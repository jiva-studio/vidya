import { type HttpClient, HttpError } from '@vidya/client'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { useSiteStatus } from '@/shared/status'
import { useSyncRuns } from '@/shared/sync'

import { useJoinSchool } from '../model'

const CODE = 'GITA42'

const school = { id: 'school-1', name: 'Gita School', logoUrl: null }

interface FakeHttp {
  readonly get: ReturnType<typeof vi.fn>
  readonly post: ReturnType<typeof vi.fn>
}

const fakeHttp = (): FakeHttp => ({ get: vi.fn(), post: vi.fn() })

const start = (http: FakeHttp) => {
  let joining!: ReturnType<typeof useJoinSchool>

  mount(
    defineComponent({
      setup() {
        joining = useJoinSchool(CODE)
        return () => null
      },
    }),
    { global: { provide: { [httpClientKey as symbol]: http as unknown as HttpClient } } },
  )

  return joining
}

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('user-1' as never)
}

describe('arriving by a school link', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    useSyncRuns().adoptRunner(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('asks the public resolve for the card, with the code as it was printed', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)

    const joining = start(http)
    await joining.resolve()

    expect(http.get).toHaveBeenCalledWith(`/j/${CODE}`)
    expect(joining.school.value).toEqual(school)
    expect(joining.stage.value).toBe('ready')
  })

  it('says the link leads nowhere when no school holds the code', async () => {
    const http = fakeHttp()
    http.get.mockRejectedValue(new HttpError(404, `/j/${CODE}`))

    const joining = start(http)
    await joining.resolve()

    expect(joining.stage.value).toBe('unknown')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('tells an unreachable server apart from an unknown code', async () => {
    const http = fakeHttp()
    http.get.mockRejectedValue(new HttpError(500, `/j/${CODE}`))

    const joining = start(http)
    await joining.resolve()

    expect(joining.stage.value).toBe('failed')
    expect(console.warn).toHaveBeenCalled()
  })

  it('joins as the signed-in student and names the school by its identifier', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)
    http.post.mockResolvedValue({ success: true })
    signIn()

    const joining = start(http)
    await joining.resolve()
    await joining.join()

    expect(http.post).toHaveBeenCalledWith('/edu/users/user-1/schools', { schoolId: school.id })
    expect(joining.stage.value).toBe('joined')
  })

  it('asks for a run at once, so the catalogue does not wait for a reload', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)
    http.post.mockResolvedValue({ success: true })
    signIn()

    const run = vi.fn()
    useSyncRuns().adoptRunner(run)

    const joining = start(http)
    await joining.resolve()
    await joining.join()

    expect(run).toHaveBeenCalledTimes(1)
    expect(useSiteStatus().joined.value).toBe(true)
  })

  it('says the school takes no students yet rather than showing a refusal', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)
    http.post.mockRejectedValue(new HttpError(409, '/edu/users/user-1/schools'))
    signIn()

    const joining = start(http)
    await joining.resolve()
    await joining.join()

    expect(joining.stage.value).toBe('closed')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('keeps a refused join apart from a school that is not taking students', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)
    http.post.mockRejectedValue(new HttpError(500, '/edu/users/user-1/schools'))
    signIn()

    const joining = start(http)
    await joining.resolve()
    await joining.join()

    expect(joining.stage.value).toBe('failed')
    expect(console.warn).toHaveBeenCalled()
  })

  it('does not join for a visitor who has no session', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)

    const joining = start(http)
    await joining.resolve()
    await joining.join()

    expect(http.post).not.toHaveBeenCalled()
    expect(joining.stage.value).toBe('ready')
  })

  it('retries the step that failed: the lookup while there is no school', async () => {
    const http = fakeHttp()
    http.get.mockRejectedValueOnce(new HttpError(500, `/j/${CODE}`)).mockResolvedValue(school)

    const joining = start(http)
    await joining.resolve()
    await joining.retry()

    expect(joining.stage.value).toBe('ready')
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('retries the join once the school is known', async () => {
    const http = fakeHttp()
    http.get.mockResolvedValue(school)
    http.post.mockRejectedValueOnce(new HttpError(500, '/x')).mockResolvedValue({ success: true })
    signIn()

    const joining = start(http)
    await joining.resolve()
    await joining.join()
    await joining.retry()

    expect(joining.stage.value).toBe('joined')
    expect(http.get).toHaveBeenCalledTimes(1)
  })
})
