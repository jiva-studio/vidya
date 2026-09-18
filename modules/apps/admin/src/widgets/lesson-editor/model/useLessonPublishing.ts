import type { LessonId, LessonVersionId } from '@vidya/domain'
import { ref } from 'vue'

import { getLessonVersions } from '@/entities/lesson'
import {
  isDraftConflict,
  openDraftOf,
  openLessonRevision,
  publishLessonVersion,
} from '@/features/publish-lesson'
import { useHttp } from '@/shared/api'

import { reasonOf } from '../lib'

/**
 * Freezing a version, and starting the next one.
 *
 * Only one draft may be open at a time, so asking for a second is a question
 * the server has already answered. The 409 is read as "here is where you should
 * be" and the editor walks into the draft that exists, rather than printing a
 * conflict at somebody who only wanted to keep writing.
 */
export const useLessonPublishing = (lessonId: LessonId) => {
  const http = useHttp()

  const busy = ref(false)
  const error = ref<string | undefined>(undefined)

  const existingDraft = async (): Promise<LessonVersionId | undefined> => {
    try {
      const { items } = await getLessonVersions(http, lessonId)
      return openDraftOf(items)?.id
    } catch {
      return undefined
    }
  }

  const publish = async (versionId: LessonVersionId): Promise<boolean> => {
    busy.value = true
    error.value = undefined

    try {
      await publishLessonVersion(http, lessonId, versionId)
      return true
    } catch (caught) {
      error.value = reasonOf(caught, 'editor-publish-failed')
      return false
    } finally {
      busy.value = false
    }
  }

  /** The id of the draft to open: the one just created, or the one already open. */
  const openRevision = async (): Promise<LessonVersionId | undefined> => {
    busy.value = true
    error.value = undefined

    try {
      const created = await openLessonRevision(http, lessonId)
      return created.id
    } catch (caught) {
      const open = isDraftConflict(caught) ? await existingDraft() : undefined
      if (!open) error.value = reasonOf(caught, 'editor-revision-failed')
      return open
    } finally {
      busy.value = false
    }
  }

  return { busy, error, publish, openRevision }
}
