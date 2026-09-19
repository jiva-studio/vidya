import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import { Course, Enrollment, Lesson, LessonVersion } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { SyncJournal } from './journalReader'

export type JournalContext = {
  school: { id: string }
  course: Course
  lesson: Lesson
  draft: LessonVersion
  student: { id: string }
  enrollment: Enrollment
}

/**
 * A school with one course, one lesson, one unpublished draft and one enrolled
 * student — the smallest world in which every projection has something to
 * address.
 *
 * Everything here is created through the ordinary services, which is the point:
 * the journal rows these fixtures produce are the same rows the admin console
 * produces, and the assertions read them back.
 */
export const createJournalContext = async (app: INestApplication): Promise<JournalContext> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
  const users = app.get(UsersService)
  const enrollments = app.get(EnrollmentsService)

  const school = await schools.create({ name: faker.company.name() })

  const course = await courses.create({
    name: 'Bhakti-shastri',
    learningType: 'individual',
    schoolId: school.id,
  })

  const lesson = await lessons.create({
    courseId: course.id,
    schoolId: school.id,
    lessonNumber: 1,
    title: 'Introduction',
  })

  const draft = await versions.createInitialDraft(lesson.id)

  // Enrollments carry a foreign key to users, so the student has to exist.
  const student = await users.create({ email: faker.internet.email() })

  const enrollment = await enrollments.create({
    courseId: course.id,
    studentId: student.id,
    schoolId: school.id,
    status: 'accepted',
  })

  return { school, course, lesson, draft, student, enrollment }
}

/** Every journal row, oldest first. */
export const journalRows = async (ds: DataSource): Promise<SyncJournal[]> =>
  ds.query('SELECT * FROM sync_journal ORDER BY global_seq')

/** The journal rows for one collection, oldest first. */
export const journalFor = async (ds: DataSource, collection: string): Promise<SyncJournal[]> =>
  ds.query('SELECT * FROM sync_journal WHERE collection = $1 ORDER BY global_seq', [collection])
