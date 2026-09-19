import type { GroupId } from '@vidya/domain'
import { ref } from 'vue'

import { useHttp } from '@/shared/api'
import { reasonOf } from '@/shared/lib'

import { createGroup, getGroup, updateGroup } from '../api'
import type { GroupFormValues } from '../types'

const blank = (): GroupFormValues => ({ name: '', courseId: '', description: '' })

/** Creating and editing a group: name, course and description, and no more. */
export const useGroupForm = (groupId?: GroupId) => {
  const http = useHttp()

  const values = ref<GroupFormValues>(blank())
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (): Promise<void> => {
    if (!groupId) return

    loading.value = true
    error.value = undefined

    try {
      const group = await getGroup(http, groupId)
      values.value = {
        name: group.name,
        courseId: group.courseId,
        description: group.description ?? '',
      }
    } catch (caught) {
      error.value = reasonOf(caught, 'group-load-failed')
    } finally {
      loading.value = false
    }
  }

  const save = async (): Promise<boolean> => {
    if (saving.value) return false

    saving.value = true
    error.value = undefined

    try {
      if (groupId) await updateGroup(http, groupId, values.value)
      else await createGroup(http, values.value)
      return true
    } catch (caught) {
      error.value = reasonOf(caught, 'group-save-failed')
      return false
    } finally {
      saving.value = false
    }
  }

  return { values, loading, saving, error, load, save }
}
