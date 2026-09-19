// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import type { LocalCourse } from '@/ports'
import { BackfillProgress, OfflineBanner } from '@/ui/sync'

import CoursesListPage from '../pages/CoursesListPage.vue'
import {
  aCourse,
  aSchool,
  mountPage,
  repositories,
  resetLocalScreens,
  seed,
  setOnline,
  settle,
  syncStatus,
} from './localScreens'

const LOGO = '[data-testid="school-logo"]'

/** Answers every read still in flight with an empty catalogue. */
const settleAll = (waiting: ((courses: LocalCourse[]) => void)[]): void => {
  waiting.splice(0).forEach((resolve) => resolve([]))
}

beforeEach(resetLocalScreens)

/**
 * One completed run of the engine, with `lands` writing the rows it brought.
 *
 * The rows land between the two edges, because that is when they land in life:
 * a run that has only just started has fetched nothing yet. Seeding before the
 * run would let a screen that re-reads on the wrong edge pass — it would find
 * the new rows already sitting there and look exactly like one that re-read at
 * the end.
 */
async function aRunCompletes(lands: () => void = () => undefined): Promise<void> {
  syncStatus.syncing.value = true
  await nextTick()

  lands()

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

    await aRunCompletes(() => {
      seed.schools.push(aSchool())
      seed.courses.push(aCourse())
    })

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('drops a course a run took away, again without leaving', async () => {
    seed.courses.push(aCourse())
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    await aRunCompletes(() => {
      seed.courses.length = 0
    })

    expect(wrapper.text()).not.toContain('Sanskrit for beginners')
  })
})

/**
 * A card in the catalogue carries its school, or carries nothing in its place.
 *
 * The join is the part with nothing else holding it up: a course knows its
 * school by id, and if the lookup quietly answered with nothing the catalogue
 * would still list every course, still be the right length, and never once
 * mention a school. Reading the badge off the rendered screen is what tells
 * those two apart.
 */
describe('the catalogue joins each course to its school', () => {
  beforeEach(() => {
    seed.schools.push(aSchool())
    seed.courses.push(aCourse())
  })

  it('names the school beside the course', async () => {
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.find(LOGO).exists()).toBe(true)
    expect(wrapper.find(`${LOGO} img`).attributes('alt')).toBe('School of Devotion')
  })

  it('shows the logo the school gave', async () => {
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.find(`${LOGO} img`).attributes('src')).toBe(
      'https://cdn.example.org/logos/devotion.png',
    )
  })

  it('shows the initial for a school that gave no logo', async () => {
    seed.schools[0] = aSchool({ logoUrl: null })

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('initial')
    expect(wrapper.find(LOGO).text()).toBe('S')
  })

  it('leaves the badge off a course whose school has not arrived', async () => {
    seed.schools.length = 0

    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
    expect(wrapper.find(LOGO).exists()).toBe(false)
  })

  it('picks up the school when it arrives a run after its course', async () => {
    seed.schools.length = 0
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    await aRunCompletes(() => seed.schools.push(aSchool()))

    expect(wrapper.find(`${LOGO} img`).attributes('alt')).toBe('School of Devotion')
  })
})

/**
 * Re-reads overlap, and the one that started last is the one that is true.
 *
 * Mounting, returning to the page and the end of a run all start a read, and
 * they do not come back in the order they left. A slow first answer arriving
 * after a fast second one would put the older catalogue back on screen, and it
 * would stay there until something else happened to trigger a read.
 */
describe('two reads in flight at once', () => {
  it('keeps the newer answer when an older one arrives late', async () => {
    const waiting: ((courses: LocalCourse[]) => void)[] = []
    repositories.courses.list = () =>
      new Promise<readonly LocalCourse[]>((resolve) => waiting.push(resolve))

    const wrapper = await mountPage(CoursesListPage)
    await settle()
    settleAll(waiting)
    await settle()

    await aRunCompletes()
    await aRunCompletes()

    // Whichever reads a mount happens to start, the last one issued is the one
    // the screen must end up showing. Taken from the ends rather than by
    // counting, so the test says that and not how many reads there were — but
    // there have to be two of them, or resolving "both" would resolve one
    // promise twice and prove nothing.
    expect(waiting.length).toBeGreaterThanOrEqual(2)
    const newest = waiting.pop()!
    const stale = waiting.shift()!

    newest([aCourse({ name: 'The newer catalogue' })])
    await settle()
    stale([aCourse({ name: 'The older catalogue' })])
    await settle()

    expect(wrapper.text()).toContain('The newer catalogue')
    expect(wrapper.text()).not.toContain('The older catalogue')
  })
})
