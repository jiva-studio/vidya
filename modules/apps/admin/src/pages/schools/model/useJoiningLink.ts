import type { SchoolId } from '@vidya/domain'
import { computed, ref } from 'vue'

import { useSchoolApi } from '@/entities/school'
import { reasonOf } from '@/shared/lib'

import { buildJoiningLink, hasNoStudentRole } from './joiningLink'

/**
 * The link a school hands out, created when somebody asks for it.
 *
 * Nothing is requested when the screen opens: until a school wants a link, no
 * link to it exists, so a school that has not asked for one cannot be reached
 * by a stale link.
 */
export const useJoiningLink = (schoolId: SchoolId) => {
  const api = useSchoolApi()

  const code = ref('')
  const busy = ref(false)
  const copied = ref(false)
  const error = ref<string | undefined>(undefined)
  const missingStudentRole = ref(false)

  const link = computed(() => (code.value ? buildJoiningLink(code.value) : ''))

  const create = async (): Promise<void> => {
    if (busy.value) return

    busy.value = true
    error.value = undefined
    missingStudentRole.value = false
    copied.value = false

    try {
      const created = await api.createCode(schoolId)
      code.value = created.code
    } catch (failure) {
      missingStudentRole.value = hasNoStudentRole(failure)
      if (!missingStudentRole.value) error.value = reasonOf(failure)
    } finally {
      busy.value = false
    }
  }

  const copy = async (): Promise<void> => {
    if (!link.value) return

    try {
      await navigator.clipboard.writeText(link.value)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // A browser that withholds the clipboard leaves the link on screen to be
      // selected by hand, which is the way out rather than a failure to report.
      copied.value = false
    }
  }

  return { code, link, busy, copied, error, missingStudentRole, create, copy }
}
