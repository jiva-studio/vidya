// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import LessonPage from '../pages/LessonPage.vue'
import {
  anEnrollment,
  aSchool,
  CHANT_ADDRESS,
  CHANT_PATH,
  ENROLLMENT_ID,
  LECTURE_ADDRESS,
  LECTURE_PATH,
  LESSON_ID,
  mediaAddresses,
  mediaLesson,
  mountPage,
  primedBatches,
  resetLocalScreens,
  seed,
  settle,
} from './mediaLessons'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
})

/**
 * A block stores a name for a file, and a player needs an address.
 *
 * `/media/<id>` is durable and unplayable: it outlives the signature that makes
 * it readable, which is why it is what the lesson keeps. The screen turns it
 * into an address before it draws, and an element handed the stored path plays
 * nothing.
 */
describe('a lesson plays the school files it holds paths to', () => {
  it('plays the video at the address the school issued', async () => {
    mediaLesson({ video: {} })
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('video').attributes('src')).toBe(LECTURE_ADDRESS)
  })

  it('plays the audio at the address the school issued', async () => {
    mediaLesson({ audio: {} })
    mediaAddresses.set(CHANT_PATH, CHANT_ADDRESS)

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('audio').attributes('src')).toBe(CHANT_ADDRESS)
  })

  it('never hands a player the stored path', async () => {
    mediaLesson({ video: {}, audio: {} })
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    mediaAddresses.set(CHANT_PATH, CHANT_ADDRESS)

    const wrapper = await openLesson()
    await settle()

    const sources = wrapper
      .findAll('video, audio, iframe')
      .map((element) => element.attributes('src') ?? '')

    expect(sources.filter((source) => source.startsWith('/media/'))).toEqual([])
  })

  it('asks for the addresses of a section in one batch', async () => {
    mediaLesson({ video: {}, audio: {} })
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    mediaAddresses.set(CHANT_PATH, CHANT_ADDRESS)

    await openLesson()
    await settle()

    const batches = primedBatches.filter((batch) => batch.length > 0)

    expect(batches).toHaveLength(1)
    expect(batches[0]!.slice().sort()).toEqual([CHANT_PATH, LECTURE_PATH].slice().sort())
  })
})

/**
 * A link to someone else's file is not a file of the school's.
 *
 * It carries its own authorisation or needs none, so it is played as it is
 * written: asking the school to sign an address it does not own would fail, and
 * the block would go dark for no reason.
 */
describe('a lesson pointing outside the school', () => {
  it('plays a direct external link as it is written', async () => {
    mediaLesson({ video: { source: 'url', url: 'https://archive.example.org/talks/1.mp4' } })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('video').attributes('src')).toBe('https://archive.example.org/talks/1.mp4')
  })

  it('keeps an embed in its frame', async () => {
    mediaLesson({ video: { source: 'youtube', url: 'https://www.youtube.com/embed/abcdef12345' } })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('iframe').attributes('src')).toBe(
      'https://www.youtube.com/embed/abcdef12345',
    )
  })

  it('asks the school for nothing when no file of its own is on the page', async () => {
    mediaLesson({ video: { source: 'url', url: 'https://archive.example.org/talks/1.mp4' } })

    await openLesson()
    await settle()

    expect(primedBatches.flat()).toEqual([])
  })
})
