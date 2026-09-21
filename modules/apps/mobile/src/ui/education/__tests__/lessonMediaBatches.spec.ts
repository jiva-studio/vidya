// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import LessonPage from '../pages/LessonPage.vue'
import {
  aLessonVersion,
  anEnrollment,
  aSchool,
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
  signedAddress,
  syncStatus,
} from './mediaLessons'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

/**
 * A run that landed rows, and a device that answers the next read as one does.
 *
 * The lesson is rebuilt from the row rather than handed back as the object the
 * last read returned: the content lives in a JSON column, so every read of the
 * same lesson produces blocks that are equal and not identical.
 */
const finishSyncRun = async () => {
  const stored = seed.versions[0]!
  seed.versions.splice(0, 1, aLessonVersion({ content: structuredClone(stored.content) }))

  syncStatus.syncing.value = true
  syncStatus.syncing.value = false
  await settle()
}

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
  mediaLesson({ video: {} })
  mediaAddresses.set(LECTURE_PATH, LECTURE_ADDRESS)
})

/**
 * The lesson is re-read whenever a sync run has touched the device.
 *
 * Re-reading answers with the same lesson and therefore the same files, and
 * asking the school to sign them again is a request per run for addresses that
 * are good for hours. What has to be asked again is a different set of files,
 * not a second copy of the same one.
 */
describe('a lesson read a second time', () => {
  it('asks the school for its files once', async () => {
    await openLesson()
    await settle()
    await finishSyncRun()

    expect(primedBatches.filter((batch) => batch.length > 0)).toHaveLength(1)
  })

  it('still plays the file after the re-read', async () => {
    const wrapper = await openLesson()
    await settle()
    await finishSyncRun()

    expect(wrapper.find('video').attributes('src')).toBe(signedAddress(LECTURE_PATH))
  })
})
