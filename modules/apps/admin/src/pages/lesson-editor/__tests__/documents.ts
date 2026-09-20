import type { LessonBlock, LessonContent } from '@vidya/domain'

import { LESSON_PATH, VERSIONS } from './harness'

/** A section as the server would hand it over, with the ids a test names blocks by. */
export const sectionOf = (id: string, title: string, blocks: LessonBlock[]) =>
  ({ id, title, assessment: 'none', blocks }) as unknown as LessonContent['sections'][number]

export const contentOf = (...sections: LessonContent['sections']): LessonContent => ({
  schemaVersion: 1,
  sections,
})

export const textBlock = (id: string, content = ''): LessonBlock =>
  ({ id, type: 'text', content }) as unknown as LessonBlock

export const imageBlock = (id: string, url = ''): LessonBlock =>
  ({ id, type: 'image', source: 'url', url }) as unknown as LessonBlock

export const quizBlock = (
  id: string,
  answers: string[] = ['Krishna', 'Arjuna'],
  question = 'Who speaks?',
): LessonBlock =>
  ({ id, type: 'quiz', question, answers, rightAnswer: 0 }) as unknown as LessonBlock

/** The four requests the editor makes when it opens a draft carrying this content. */
export const draftOf = (content: LessonContent, status: 'draft' | 'published' = 'draft') => {
  const details = { id: 'v1', lessonId: 'l1', version: 1, status, content }

  return {
    [`GET ${LESSON_PATH}`]: { id: 'l1', courseId: 'c1', lessonNumber: 1, title: 'The alphabet' },
    [`GET ${VERSIONS}`]: { items: [{ id: 'v1', lessonId: 'l1', version: 1, status }] },
    [`GET ${VERSIONS}/v1`]: details,
    [`PATCH ${VERSIONS}/v1`]: details,
  }
}
