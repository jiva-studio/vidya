import type { EnrollmentId, GroupId } from '@vidya/domain'
import type { ToastItem } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { useAssignGroup } from './useAssignGroup'

interface Undoable {
  enrollmentId: EnrollmentId
  previous: GroupId | null
}

/**
 * Assignment as the screen experiences it: done at once, and offered back.
 *
 * Every other decision on these screens is final, so this is the only place an
 * undo is honest. The toast carries the group the student was in before, and
 * taking it back is the same request with that value.
 */
export const useGroupAssignment = () => {
  const { assign, busy, error } = useAssignGroup()
  const { $t } = useFluent()

  const toasts = ref<ToastItem[]>([])
  const undoable = new Map<string, Undoable>()

  const dismiss = (id: string): void => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
    undoable.delete(id)
  }

  const announce = (entry: Undoable): void => {
    const id = `assign-${entry.enrollmentId}`
    undoable.set(id, entry)
    toasts.value = [
      ...toasts.value.filter((toast) => toast.id !== id),
      { id, title: $t('enrollments-group-done'), actionLabel: $t('action-undo'), tone: 'success' },
    ]
  }

  const submit = async (
    enrollmentId: EnrollmentId,
    groupId: GroupId | null,
    previous: GroupId | null,
  ): Promise<boolean> => {
    const done = await assign(enrollmentId, groupId)
    if (done) announce({ enrollmentId, previous })
    return done
  }

  const undo = async (id: string): Promise<boolean> => {
    const entry = undoable.get(id)
    if (!entry) return false

    dismiss(id)
    return assign(entry.enrollmentId, entry.previous)
  }

  return { submit, undo, dismiss, toasts, busy, error }
}
