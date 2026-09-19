import type { RoleId } from '@vidya/domain'
import { ref } from 'vue'

import type { RoleRow } from '@/entities/role'
import { useRoleApi } from '@/entities/role'
import { useUserApi } from '@/entities/user'
import { reasonOf } from '@/shared/lib'

import type { UserIdSource } from './types'

/**
 * Assigning and removing a user's roles.
 *
 * The API takes the whole set rather than one assignment, so removing a role
 * is sending the set without it. The answer carries no payload, so the state
 * is advanced locally once the server has accepted it — which is what makes
 * the change visible without reloading the screen.
 */
export const useUserRoles = (userId: UserIdSource) => {
  const users = useUserApi()
  const roles = useRoleApi()

  const assigned = ref<RoleId[]>([])
  const available = ref<RoleRow[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | undefined>(undefined)

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    assigned.value = []
    available.value = []

    try {
      const [held, all] = await Promise.all([users.roles(userId()), roles.list()])
      assigned.value = held.userRoles.map((entry) => entry.roleId)
      available.value = all.items
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  const save = async (next: RoleId[]): Promise<void> => {
    saving.value = true
    error.value = undefined

    try {
      await users.setRoles(userId(), next)
      assigned.value = next
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      saving.value = false
    }
  }

  const assign = (roleId: RoleId): Promise<void> =>
    assigned.value.includes(roleId) ? Promise.resolve() : save([...assigned.value, roleId])

  const revoke = (roleId: RoleId): Promise<void> =>
    save(assigned.value.filter((held) => held !== roleId))

  return { assigned, available, loading, saving, error, load, assign, revoke }
}
