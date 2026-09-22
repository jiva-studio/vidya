// @vitest-environment jsdom
import { FluentBundle } from '@fluent/bundle'
import { HttpError, OfflineError } from '@vidya/client'
import { Routes } from '@vidya/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import resources from '../i18n'
import LessonPage from '../pages/LessonPage.vue'
import {
  anEnrollment,
  aSchool,
  ENROLLMENT_ID,
  LESSON_ID,
  LESSON_TEXT,
  mediaLesson,
  mountPage,
  refuseBatchWith,
  resetLocalScreens,
  seed,
  settle,
} from './mediaLessons'

const UNAVAILABLE = '[data-testid="media-unavailable"]'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

/** What a reader of the English locale sees for a key, so no test spells it out. */
const messageFor = (key: string): string => {
  const bundle = new FluentBundle('en', { useIsolating: false })
  resources.en.forEach((resource) => bundle.addResource(resource))

  const pattern = bundle.getMessage(key)?.value
  if (pattern === undefined || pattern === null) throw new Error(`the locale carries no ${key}`)

  return bundle.formatPattern(pattern)
}

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.enrollments.push(anEnrollment())
  mediaLesson({ video: {} })
})

/**
 * The school refusing a read is not the network failing.
 *
 * A batch none of whose files this student may read is answered with a refusal,
 * and a student whose enrolment has lapsed sits on a working connection: told to
 * check the network, they check it forever. The two have to read differently on
 * the screen, because only one of them is worth waiting for.
 */
describe('a lesson whose files the school refuses', () => {
  it('says the school no longer opens the file rather than blaming the network', async () => {
    refuseBatchWith(new HttpError(403, Routes().media.urls()))

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find(UNAVAILABLE).text()).toBe(messageFor('media-not-permitted'))
  })

  it('goes on reading out the text of the lesson', async () => {
    refuseBatchWith(new HttpError(403, Routes().media.urls()))

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.text()).toContain(LESSON_TEXT)
  })
})

describe('a lesson whose batch never left the device', () => {
  it('says the file waits for a connection', async () => {
    refuseBatchWith(new OfflineError(Routes().media.urls()))

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.find(UNAVAILABLE).text()).toBe(messageFor('media-needs-connection'))
  })
})
