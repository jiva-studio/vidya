// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { BackfillProgress, OfflineBanner } from '@/ui/sync'

import CoursesListPage from '../pages/CoursesListPage.vue'
import {
  aCourse,
  aSchool,
  mountPage,
  resetLocalScreens,
  seed,
  setOnline,
  settle,
  syncStatus,
} from './localScreens'

beforeEach(resetLocalScreens)

/** One completed run of the engine, as the screens see it happen. */
async function aRunCompletes(): Promise<void> {
  syncStatus.syncing.value = true
  await nextTick()
  syncStatus.syncing.value = false
  await settle()
}

/**
 * The catalogue is a view of the device, and the device does not go offline.
 *
 * The three states it has to tell apart are "nothing has been downloaded yet",
 * "nothing is here and nothing is coming" and "here is what there is". Only the
 * last two are about the courses; the first is about the first run, and showing
 * an empty list for it is telling the student the school is empty.
 */
describe('the catalogue reads the device', () => {
  it('names the courses that are on the device', async () => {
    seed.schools.push(aSchool())
    seed.courses.push(aCourse())

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('names them with the radio switched off', async () => {
    seed.schools.push(aSchool())
    seed.courses.push(aCourse())
    setOnline(false)

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('shows the first run filling the device rather than an empty catalogue', async () => {
    syncStatus.firstRunCompleted.value = false
    syncStatus.done.value = 3
    syncStatus.total.value = 12

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.findComponent(BackfillProgress).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No courses here yet')
  })

  it('hands the first run its progress rather than an empty bar', async () => {
    syncStatus.firstRunCompleted.value = false
    syncStatus.done.value = 3
    syncStatus.total.value = 12

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.findComponent(BackfillProgress).props()).toMatchObject({ done: 3, total: 12 })
  })

  it('says it is working offline when the first run cannot even start', async () => {
    syncStatus.firstRunCompleted.value = false
    setOnline(false)

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.findComponent(OfflineBanner).exists()).toBe(true)
    expect(wrapper.findComponent(OfflineBanner).props('online')).toBe(false)
  })

  it('stands down once the device has been filled once', async () => {
    seed.courses.push(aCourse())

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.findComponent(BackfillProgress).exists()).toBe(false)
  })

  it('picks up what a run brought without the student leaving the screen', async () => {
    const wrapper = await mountPage(CoursesListPage)
    await settle()
    expect(wrapper.text()).not.toContain('Sanskrit for beginners')

    seed.schools.push(aSchool())
    seed.courses.push(aCourse())
    await aRunCompletes()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('drops a course a run took away, again without leaving', async () => {
    seed.courses.push(aCourse())
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    seed.courses.length = 0
    await aRunCompletes()

    expect(wrapper.text()).not.toContain('Sanskrit for beginners')
  })
})
