import type { PermissionKey } from '@vidya/domain'
import { computed, type ComputedRef } from 'vue'

import { grants } from '../session'
import { useSession } from '../session'
import { useCurrentSchool } from './useCurrentSchool'

/**
 * The only way the interface asks whether something is allowed.
 *
 * A second implementation anywhere is how the menu and the button that opens
 * the same screen end up disagreeing. Hiding is a courtesy: the server refuses
 * regardless, and the refusal is always shown.
 */
export const useCan = (permission: PermissionKey): ComputedRef<boolean> => {
  const { permissions } = useSession()
  const { schoolId } = useCurrentSchool()

  return computed(() => grants(permissions.value, schoolId.value, permission))
}
