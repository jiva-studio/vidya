import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { CourseDetails } from '../courses'
import type { EnrollmentDetails } from '../enrollments'
import type { BlockStateDetails, HomeworkDetails } from '../homework'
import type { LessonDetails, LessonVersionDetails } from '../lessons'

/**
 * The fixtures are the contract both sides of the wire are tested against, and
 * nothing else checks that their field names are the protocol's field names.
 *
 * Both sides ignore keys they do not know, so a fixture calling a course's name
 * `title` passes on the server, passes on the device, and describes a message
 * neither of them would ever send. That is exactly what happened: `title` sat
 * in three fixtures while the protocol and the table both said `name`.
 *
 * The lists below are typed as `keyof`, so renaming a field in the protocol
 * breaks compilation here rather than quietly widening what a fixture may say.
 */
const ALLOWED: Partial<Record<string, readonly string[]>> = {
  courses: [
    'id',
    'schoolId',
    'name',
    'description',
    'learningType',
  ] satisfies readonly (keyof CourseDetails)[],
  lessons: ['id', 'courseId', 'lessonNumber', 'title'] satisfies readonly (keyof LessonDetails)[],
  lesson_versions: [
    'id',
    'lessonId',
    'version',
    'status',
    'content',
    'publishedAt',
  ] satisfies readonly (keyof LessonVersionDetails)[],
  enrollments: [
    'id',
    'courseId',
    'groupId',
    'studentId',
    'schoolId',
    'status',
    'decidedById',
    'decidedAt',
    'createdAt',
  ] satisfies readonly (keyof EnrollmentDetails)[],
  homework: [
    'id',
    'enrollmentId',
    'lessonVersionId',
    'sectionId',
    'schoolId',
    'status',
    'text',
    'grade',
    'answeredSupersededVersion',
    'reviewedById',
    'submittedAt',
    'reviewedAt',
    'createdAt',
  ] satisfies readonly (keyof HomeworkDetails)[],
  block_states: [
    'id',
    'enrollmentId',
    'lessonVersionId',
    'blockId',
    'schoolId',
    'state',
    'updatedAt',
  ] satisfies readonly (keyof BlockStateDetails)[],
}

type Change = { collection?: string; data?: unknown }

const changesIn = (node: unknown, out: Change[] = []): Change[] => {
  if (Array.isArray(node)) {
    node.forEach((item) => changesIn(item, out))
    return out
  }
  if (node === null || typeof node !== 'object') return out

  const record = node as Record<string, unknown>
  if (typeof record.collection === 'string') out.push(record as Change)
  Object.values(record).forEach((value) => changesIn(value, out))

  return out
}

const directory = join(__dirname, '..', '__fixtures__', 'sync')

describe('wire fixtures', () => {
  const files = readdirSync(directory).filter((name) => name.endsWith('.json'))

  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s names fields the way the protocol does', (file) => {
    const parsed: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'))

    changesIn(parsed).forEach((change) => {
      const allowed = ALLOWED[change.collection ?? '']
      if (!allowed || change.data === null || typeof change.data !== 'object') return

      const unknownKeys = Object.keys(change.data as Record<string, unknown>).filter(
        (key) => !allowed.includes(key),
      )

      expect({ file, collection: change.collection, unknownKeys }).toEqual({
        file,
        collection: change.collection,
        unknownKeys: [],
      })
    })
  })
})
