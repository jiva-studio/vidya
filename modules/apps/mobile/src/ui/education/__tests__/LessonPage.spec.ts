// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { SyncRejectionNotice, SyncStateBadge } from '@/ui/sync'

import LessonPage from '../pages/LessonPage.vue'
import {
  aHomework,
  aLesson,
  aLessonVersion,
  anEnrollment,
  aSchool,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_ID,
  mountPage,
  outboxRows,
  resetLocalScreens,
  seed,
  settle,
} from './localScreens'

const openLesson = () => mountPage(LessonPage, { enrollmentId: ENROLLMENT_ID, lessonId: LESSON_ID })

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.lessons.push(aLesson())
  seed.versions.push(aLessonVersion())
  seed.enrollments.push(anEnrollment())
})

/**
 * Where an answer has got to is part of the answer, not a notification.
 *
 * The device accepts work whether or not there is a connection, so "saved" and
 * "the school has it" are different facts and the student is the one who needs
 * to tell them apart. A refusal is the same thing one step further on: it is a
 * state the answer keeps, shown next to the answer, with the reason.
 */
describe('an answer says where it has got to', () => {
  it('shows a submitted answer waiting to go out', async () => {
    seed.homework.push(aHomework())
    outboxRows.set(`homework:${HOMEWORK_ID}`, { state: 'notSent' })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.findComponent(SyncStateBadge).props('state')).toBe('notSent')
  })

  it('shows a submitted answer the school has taken', async () => {
    seed.homework.push(aHomework({ status: 'in_review' }))
    outboxRows.set(`homework:${HOMEWORK_ID}`, { state: 'accepted' })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.findComponent(SyncStateBadge).props('state')).toBe('accepted')
  })

  it('says nothing about sending while the answer is still being written', async () => {
    seed.homework.push(aHomework({ status: 'open', submittedAt: null }))

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.findComponent(SyncStateBadge).exists()).toBe(false)
  })

  it('shows the refusal, and the reason, on an answer the server would not take', async () => {
    seed.homework.push(aHomework())
    outboxRows.set(`homework:${HOMEWORK_ID}`, {
      state: 'rejected',
      reason: 'unknownLessonVersion',
    })

    const wrapper = await openLesson()
    await settle()

    const notice = wrapper.findComponent(SyncRejectionNotice)
    expect(notice.exists()).toBe(true)
    expect(notice.props('reason')).toBe('unknownLessonVersion')
    expect(notice.text()).toContain('does not know the lesson version')
  })

  it('keeps the refused answer on screen, because the device still holds it', async () => {
    seed.homework.push(aHomework())
    outboxRows.set(`homework:${HOMEWORK_ID}`, { state: 'rejected', reason: 'malformed' })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.text()).toContain('The vowels are a, aa, i.')
  })

  it('leaves an accepted answer without a refusal notice', async () => {
    seed.homework.push(aHomework())
    outboxRows.set(`homework:${HOMEWORK_ID}`, { state: 'accepted' })

    const wrapper = await openLesson()
    await settle()

    expect(wrapper.findComponent(SyncRejectionNotice).exists()).toBe(false)
  })
})
