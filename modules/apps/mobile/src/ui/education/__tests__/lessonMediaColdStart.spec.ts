// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  mediaAddresses,
  mediaLesson,
  mountPage,
  playerSource,
  resetLocalScreens,
  seed,
  setOnline,
  settle,
  signedAddress,
  startRadio,
} from './mediaLessons'

const UNAVAILABLE = '[data-testid="media-unavailable"]'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
  mediaLesson({ video: {} })
  startRadio(false)
})

/**
 * The app was started underground, and nothing was announced.
 *
 * Capacitor emits `networkStatusChange` on a change and never on a start, so a
 * launch with the radio already off is silent: the only way the app can know is
 * to ask. If it does not ask, the connection coming back is not a change to
 * anything it believes, and the lesson waits for an address that is never asked
 * for again.
 */
describe('a lesson opened with the radio off since launch', () => {
  it('plays the file once the connection comes back', async () => {
    const wrapper = await openLesson()
    await settle()
    expect(wrapper.find(UNAVAILABLE).exists()).toBe(true)

    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    setOnline(true)
    await settle()

    expect(playerSource(wrapper)).toBe(signedAddress(LECTURE_PATH))
  })
})
