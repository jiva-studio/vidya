// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import LessonPage from '../pages/LessonPage.vue'
import {
  anEnrollment,
  aSchool,
  ENROLLMENT_ID,
  LECTURE_ADDRESS,
  LECTURE_PATH,
  LESSON_ID,
  LESSON_TEXT,
  mediaAddresses,
  mediaLesson,
  mountPage,
  playerSource,
  primedBatches,
  resetLocalScreens,
  seed,
  signedAddress,
  signFor,
} from './mediaLessons'

const NOON = Date.parse('2026-09-21T12:00:00.000Z')
const WINDOW_SECONDS = 120

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

/** The same wait as `settle`, on a clock the test is holding still. */
const settleClock = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) {
    await vi.advanceTimersByTimeAsync(0)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
  mediaLesson({ video: {} })
  signFor(WINDOW_SECONDS)
  mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * A lesson left open outlives the signature it was opened with.
 *
 * The address stops working at an instant nobody on the screen is watching for,
 * and a player asked for the next range after it gets a refusal in the middle of
 * a lecture. Whatever the screen is showing by then, it is not the address whose
 * window has closed.
 */
describe('a lesson held open past the window of its addresses', () => {
  it('stops handing the player the address whose window has closed', async () => {
    const wrapper = await openLesson()
    await settleClock()

    const opening = playerSource(wrapper)
    expect(opening).toBe(signedAddress(LECTURE_PATH))

    await vi.advanceTimersByTimeAsync(WINDOW_SECONDS * 1000 + 1000)
    await settleClock()

    expect(playerSource(wrapper)).not.toBe(opening)
  })

  it('goes on reading out the text of the lesson', async () => {
    const wrapper = await openLesson()
    await settleClock()

    await vi.advanceTimersByTimeAsync(WINDOW_SECONDS * 1000 + 1000)
    await settleClock()

    expect(wrapper.text()).toContain(LESSON_TEXT)
  })
})

/**
 * A lecture is longer than nothing, and the window ends during it.
 *
 * Taking the dead address away is half the answer: a student watching a lesson
 * meets a player that stops and never starts again, on a connection that works.
 * The signature is asked for again while the lesson is open, so the block that
 * was playing goes on playing.
 */
describe('a lesson still open when the window of its addresses closes', () => {
  it('asks the school again and goes on playing', async () => {
    const wrapper = await openLesson()
    await settleClock()
    const askedOnOpening = primedBatches.filter((batch) => batch.length > 0).length

    await vi.advanceTimersByTimeAsync(WINDOW_SECONDS * 1000 + 1000)
    await settleClock()

    expect(playerSource(wrapper)).toBe(signedAddress(LECTURE_PATH))
    expect(primedBatches.filter((batch) => batch.length > 0).length).toBeGreaterThan(askedOnOpening)
  })
})
