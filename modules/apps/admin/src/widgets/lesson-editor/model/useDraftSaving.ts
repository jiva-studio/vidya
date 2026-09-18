import type { LessonContent, LessonId, LessonVersionId } from '@vidya/domain'
import { ref } from 'vue'

import { saveLessonVersion } from '@/features/edit-lesson-content'
import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

/**
 * Saving the draft: one request, the whole document.
 *
 * A failure leaves the edits on screen untouched. The author's work only exists
 * in this tab, so an error that cleared the form to show itself would be the
 * most expensive message in the admin.
 */
export const useDraftSaving = (lessonId: LessonId) => {
  const http = useHttp()

  const saving = ref(false)
  const error = ref<string | undefined>(undefined)

  const save = async (versionId: LessonVersionId, content: LessonContent): Promise<boolean> => {
    saving.value = true
    error.value = undefined

    try {
      await saveLessonVersion(http, lessonId, versionId, content)
      return true
    } catch (caught) {
      error.value = reasonOf(caught, 'editor-save-failed')
      return false
    } finally {
      saving.value = false
    }
  }

  return { saving, error, save }
}
