import type { LessonId, LessonVersionId } from '@vidya/domain'
import type { LessonVersionDetails } from '@vidya/protocol'
import { ref } from 'vue'

import { getLessonVersions } from '@/entities/lesson'
import { getLessonVersion } from '@/features/edit-lesson-content'
import { versionToOpen } from '@/features/publish-lesson'
import { useHttp } from '@/shared/api'

import { reasonOf } from '../lib'

/**
 * The version the editor has open.
 *
 * Opening never creates anything: the server gives every lesson a draft of
 * version 1 when the lesson is created, so an editor that posted a version on
 * entry would make a second one the first time somebody opened a published
 * lesson to read it.
 */
export const useLessonVersionDocument = (lessonId: LessonId) => {
  const http = useHttp()

  const loading = ref(false)
  const error = ref<string | undefined>(undefined)
  const version = ref<LessonVersionDetails | undefined>(undefined)

  const open = async (preferred?: LessonVersionId): Promise<void> => {
    loading.value = true
    error.value = undefined

    try {
      const { items } = await getLessonVersions(http, lessonId)
      const target = preferred ?? versionToOpen(items)?.id

      if (!target) {
        error.value = 'editor-no-versions'
        return
      }

      version.value = await getLessonVersion(http, lessonId, target)
    } catch (caught) {
      error.value = reasonOf(caught, 'editor-load-failed')
    } finally {
      loading.value = false
    }
  }

  return { loading, error, version, open }
}
