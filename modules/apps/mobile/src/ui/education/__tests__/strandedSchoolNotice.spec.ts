// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { SignInAgainNotice } from '@/ui/sync'

import CoursesListPage from '../pages/CoursesListPage.vue'
import MyEnrollmentsPage from '../pages/MyEnrollmentsPage.vue'
import {
  aCourse,
  anEnrollment,
  awaitingSignIn,
  mountPage,
  resetLocalScreens,
  seed,
  settle,
} from './localScreens'

beforeEach(resetLocalScreens)

const strand = (schools: number) => {
  awaitingSignIn.value = Array.from({ length: schools }, (_, at) => ({
    baseUrl: `https://school-${at}.example`,
  }))
}

const screens = [
  ['the catalogue', CoursesListPage],
  ['my enrolments', MyEnrollmentsPage],
] as const

/**
 * A school whose sign-in the server stopped accepting.
 *
 * Nothing new arrives from it and nothing leaves for it, while everything
 * already downloaded goes on reading and the student's other schools go on
 * syncing. So the screens that show what a school sent say which of them has
 * gone quiet — and say it beside the list rather than instead of it.
 */
describe('a school waiting for a new sign-in is named on the screens it feeds', () => {
  it.each(screens)('says nothing on %s while every school is reachable', async (_name, page) => {
    const wrapper = await mountPage(page)
    await settle()

    expect(wrapper.findComponent(SignInAgainNotice).exists()).toBe(false)
  })

  it.each(screens)('speaks up on %s once a school has gone quiet', async (_name, page) => {
    strand(1)

    const wrapper = await mountPage(page)
    await settle()

    expect(wrapper.findComponent(SignInAgainNotice).props('schools')).toBe(1)
  })

  it.each(screens)('counts the schools it is speaking about on %s', async (_name, page) => {
    strand(3)

    const wrapper = await mountPage(page)
    await settle()

    expect(wrapper.findComponent(SignInAgainNotice).props('schools')).toBe(3)
  })

  it('keeps the enrolments readable beside the notice rather than in place of them', async () => {
    seed.courses.push(aCourse({ name: 'Sanskrit, first steps' }))
    seed.enrollments.push(anEnrollment())
    strand(1)

    const wrapper = await mountPage(MyEnrollmentsPage)
    await settle()

    expect(wrapper.findComponent(SignInAgainNotice).exists()).toBe(true)
    expect(wrapper.text()).toContain('Sanskrit, first steps')
  })
})
