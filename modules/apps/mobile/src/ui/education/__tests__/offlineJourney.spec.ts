// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import CourseDetailsPage from '../pages/CourseDetailsPage.vue'
import CoursesListPage from '../pages/CoursesListPage.vue'
import LessonPage from '../pages/LessonPage.vue'
import MyEnrollmentPage from '../pages/MyEnrollmentPage.vue'
import MyEnrollmentsPage from '../pages/MyEnrollmentsPage.vue'
import {
  aCourse,
  aLesson,
  aLessonVersion,
  anEnrollment,
  aSchool,
  COURSE_ID,
  ENROLLMENT_ID,
  LESSON_ID,
  mountPage,
  resetLocalScreens,
  seed,
  setOnline,
  settle,
} from './localScreens'

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.courses.push(aCourse())
  seed.lessons.push(aLesson())
  seed.versions.push(aLessonVersion())
  seed.enrollments.push(anEnrollment())
  setOnline(false)
})

/**
 * The whole path with the radio off, one screen at a time.
 *
 * Each of them used to be a request, so each of them used to be blank in the
 * metro. The point of the walk is that no step of it is a special case: the
 * catalogue is not the offline screen and the lesson the online one.
 */
describe('the path from catalogue to lesson with no connection', () => {
  it('lists the courses', async () => {
    const wrapper = await mountPage(CoursesListPage)
    await settle()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('opens a course', async () => {
    const wrapper = await mountPage(CourseDetailsPage, { id: COURSE_ID })
    await settle()

    expect(wrapper.text()).toContain('The alphabet, sandhi and the first verses.')
  })

  it('lists the enrolments the student holds', async () => {
    const wrapper = await mountPage(MyEnrollmentsPage)
    await settle()

    expect(wrapper.text()).toContain('Sanskrit for beginners')
    expect(wrapper.text()).not.toContain('You have not enrolled on anything yet')
  })

  it('opens an enrolment and lists its lessons', async () => {
    const wrapper = await mountPage(MyEnrollmentPage, { enrollmentId: ENROLLMENT_ID })
    await settle()

    expect(wrapper.text()).toContain('The alphabet')
  })

  it('opens an enrolment the school has taken back, in words rather than in a message id', async () => {
    // A place withdrawn after it was given is its own outcome, told apart from
    // a request that was never granted. An unwritten message shows as its id,
    // which is the shape a forgotten status takes on screen.
    seed.enrollments[0] = anEnrollment({ status: 'revoked' })

    const wrapper = await mountPage(MyEnrollmentPage, { enrollmentId: ENROLLMENT_ID })
    await settle()

    expect(wrapper.text()).not.toContain('enrollment-revoked')
    expect(wrapper.text().trim()).not.toBe('')
  })

  it('opens a lesson and draws what was downloaded', async () => {
    const wrapper = await mountPage(LessonPage, {
      enrollmentId: ENROLLMENT_ID,
      lessonId: LESSON_ID,
    })
    await settle()

    expect(wrapper.text()).toContain('The vowels come first.')
  })
})
