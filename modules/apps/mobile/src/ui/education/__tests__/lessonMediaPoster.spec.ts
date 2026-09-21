// @vitest-environment jsdom
import type { BlockId, LessonBlock, MediaId } from '@vidya/domain'
import { asId, mediaPath } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { listSchoolFilePaths } from '../model/sectionMedia'
import LessonPage from '../pages/LessonPage.vue'
import {
  aLesson,
  aLessonVersion,
  anEnrollment,
  aSchool,
  ENROLLMENT_ID,
  LECTURE_ADDRESS,
  LECTURE_PATH,
  LESSON_ID,
  mediaAddresses,
  mountPage,
  primedBatches,
  resetLocalScreens,
  SECTION_ID,
  seed,
  settle,
  signedAddress,
} from './mediaLessons'

const POSTER_ID = asId<MediaId>('e5f60718-2930-4a45-bc6d-7e8f90102132')
const POSTER_PATH = mediaPath(POSTER_ID)
const POSTER_ADDRESS = `https://cdn.school.example/${POSTER_ID}/original.jpg?token=abc`

const EXTERNAL = 'https://archive.example.org/talks/1.mp4'

const videoWithPoster = (url: string, posterUrl: string): LessonBlock => ({
  id: asId<BlockId>('blk-video'),
  type: 'video',
  source: 'upload',
  url,
  posterUrl,
})

const seedLesson = (blocks: LessonBlock[]) => {
  seed.lessons.push(aLesson())
  seed.versions.push(
    aLessonVersion({
      content: {
        schemaVersion: 1,
        sections: [{ id: SECTION_ID, title: 'Letters', assessment: 'none', blocks }],
      },
    }),
  )
}

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
})

/**
 * A poster is a file of the school like the video it stands in for.
 *
 * It is stored as a path for the same reason and is just as unplayable, so it
 * belongs in the batch the screen asks for: a video left with the stored path
 * as its poster shows a broken frame until it is pressed.
 */
describe('the still frame of a video block', () => {
  it('shows the poster at the address the school issued', async () => {
    seedLesson([videoWithPoster(LECTURE_PATH, POSTER_PATH)])
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    mediaAddresses.set(POSTER_PATH, POSTER_ADDRESS)

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('video').attributes('poster')).toBe(signedAddress(POSTER_PATH))
  })

  it('never hands the player the stored path of a poster', async () => {
    seedLesson([videoWithPoster(LECTURE_PATH, POSTER_PATH)])
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find('video').attributes('poster')).toBeUndefined()
  })

  it('asks for the poster in the same batch as the video', async () => {
    seedLesson([videoWithPoster(LECTURE_PATH, POSTER_PATH)])
    mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
    mediaAddresses.set(POSTER_PATH, POSTER_ADDRESS)

    await openLesson()
    await settle()

    const batches = primedBatches.filter((batch) => batch.length > 0)

    expect(batches).toHaveLength(1)
    expect(batches[0]!.slice().sort()).toEqual([LECTURE_PATH, POSTER_PATH].slice().sort())
  })
})

/**
 * What the school is asked to sign, and what it is not.
 *
 * The batch names files of the school and nothing else: a link to someone
 * else's server carries its own authorisation, and a file named twice in one
 * section is one id on the wire.
 */
describe('the paths a section asks the school for', () => {
  it('names a poster beside the video it belongs to', () => {
    expect(listSchoolFilePaths([videoWithPoster(LECTURE_PATH, POSTER_PATH)])).toEqual([
      LECTURE_PATH,
      POSTER_PATH,
    ])
  })

  it('leaves out a source that is not a file of the school', () => {
    expect(listSchoolFilePaths([videoWithPoster(EXTERNAL, POSTER_PATH)])).toEqual([POSTER_PATH])
  })

  it('names a file used twice in the section once', () => {
    expect(listSchoolFilePaths([videoWithPoster(LECTURE_PATH, LECTURE_PATH)])).toEqual([
      LECTURE_PATH,
    ])
  })
})
