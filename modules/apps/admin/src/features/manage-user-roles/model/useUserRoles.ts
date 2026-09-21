import type { RoleId } from '@vidya/domain'
import { computed, ref } from 'vue'

import type { RoleRow } from '@/entities/role'
import { useRoleApi } from '@/entities/role'
import { useUserApi } from '@/entities/user'
import { reasonOf } from '@/shared/lib'

import type { UserIdSource } from './types'

const sameSet = (a: readonly RoleId[], b: readonly RoleId[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id))

/**
 * A user's roles, edited and then saved.
 *
 * The API takes the whole set rather than one assignment, so removing a role
 * is sending the set without it. Nothing is sent until `save`: the roles sit
 * on the same card as the name and go to the server with it, under the one
 * button, rather than each tick being its own silent request.
 */
export const useUserRoles = (userId: UserIdSource) => {
  const users = useUserApi()
  const roles = useRoleApi()

  const held = ref<RoleId[]>([])
  const selected = ref<RoleId[]>([])
  const available = ref<RoleRow[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | undefined>(undefined)

  const dirty = computed(() => !sameSet(held.value, selected.value))

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = undefined
    held.value = []
    selected.value = []
    available.value = []

    try {
      const [assigned, all] = await Promise.all([users.roles(userId()), roles.list()])
      held.value = assigned.userRoles.map((entry) => entry.roleId)
      selected.value = [...held.value]
      available.value = all.items
    } catch (failure) {
      error.value = reasonOf(failure)
    } finally {
      loading.value = false
    }
  }

  const save = async (): Promise<boolean> => {
    if (!dirty.value) return true

    saving.value = true
    error.value = undefined

    try {
      await users.setRoles(userId(), selected.value)
      held.value = [...selected.value]
      return true
    } catch (failure) {
      error.value = reasonOf(failure)
      return false
    } finally {
      saving.value = false
    }
  }

  const reset = (): void => {
    selected.value = [...held.value]
    error.value = undefined
  }

  const toggle = (roleId: RoleId, wanted: boolean): void => {
    const without = selected.value.filter((id) => id !== roleId)
    selected.value = wanted ? [...without, roleId] : without
  }

  return { available, selected, dirty, loading, saving, error, load, save, reset, toggle }
}
