// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
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
  LESSON_TEXT,
  mediaAddresses,
  mediaLesson,
  mountPage,
  primedBatches,
  resetLocalScreens,
  seed,
  setOnline,
  settle,
  signedAddress,
} from './mediaLessons'

const UNAVAILABLE = '[data-testid="media-unavailable"]'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

const storedPaths = (wrapper: VueWrapper) =>
  wrapper
    .findAll('video, audio, iframe')
    .map((element) => element.attributes('src') ?? '')
    .filter((source) => source.startsWith('/media/'))

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
  mediaLesson({ video: {} })
})

/**
 * The content is downloaded; the permission to read the file is not.
 *
 * Everything a lesson is made of sits on the device, and an address for a
 * school file has to be asked for. With the radio off there is no address, and
 * the honest answer is that this one piece waits for a connection — not a
 * player pointed at nothing, and not a section that vanishes.
 */
describe('a school file in a lesson read with no connection', () => {
  beforeEach(() => setOnline(false))

  it('says the file waits for a connection', async () => {
    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find(UNAVAILABLE).exists()).toBe(true)
  })

  it('points no player at the stored path', async () => {
    const wrapper = await openLesson()
    await settle()

    expect(storedPaths(wrapper)).toEqual([])
  })

  it('still reads out the text of the lesson', async () => {
    const wrapper = await openLesson()
    await settle()

    expect(wrapper.text()).toContain(LESSON_TEXT)
  })
})

/**
 * A file the school did not give an address for is not a failure of the screen.
 *
 * The batch answers with what this reader may have, and an id it may not have
 * is simply absent. The block it belongs to says so and the rest of the lesson
 * is unaffected.
 */
describe('a file the school issued no address for', () => {
  it('says the file waits for a connection rather than breaking the page', async () => {
    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find(UNAVAILABLE).exists()).toBe(true)
    expect(wrapper.text()).toContain(LESSON_TEXT)
  })

  it('points no player at the stored path', async () => {
    const wrapper = await openLesson()
    await settle()

    expect(storedPaths(wrapper)).toEqual([])
  })
})

/**
 * The connection comes back while the lesson is open.
 *
 * Nobody leaves a lesson and comes back to it to find out whether the video
 * works now: the addresses are asked for again the moment the radio is back,
 * and the block that was waiting starts playing.
 */
describe('the connection coming back under an open lesson', () => {
  beforeEach(() => setOnline(false))

  it('asks the school for the addresses again', async () => {
    await openLesson()
    await settle()

    const askedWhileOffline = primedBatches.length
    setOnline(true)
    await settle()

    expect(primedBatches.length).toBeGreaterThan(askedWhileOffline)
  })

  it('plays the file without the lesson being opened again', async () => {
    const wrapper = await openLesson()
    await settle()

    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    setOnline(true)
    await settle()

    expect(wrapper.find('video').attributes('src')).toBe(signedAddress(LECTURE_PATH))
    expect(wrapper.find(UNAVAILABLE).exists()).toBe(false)
  })
})
