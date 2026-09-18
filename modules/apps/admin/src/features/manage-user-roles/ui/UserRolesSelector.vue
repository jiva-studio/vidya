<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import { Badge, Checkbox, EmptyState, ErrorState, Skeleton } from '@vidya/ui'
import { computed, onMounted } from 'vue'

import type { RoleRow } from '@/entities/role'
import { useCan } from '@/shared/access'

import { useUserRoles } from '../model'
import type { UserRolesSelectorProps } from '../types'
import { badgesClasses, listClasses, noticeClasses, sectionClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserRolesSelectorProps>()

/* --------------------------------- State ---------------------------------- */

// The school is read at the moment of the request, so a switch mid-screen
// cannot send the previous school's identifier.
const roles = useUserRoles(() => props.userId)

// Hidden rather than disabled: a control nobody can explain is worse than no
// control at all. The server refuses either way.
const canManage = useCan('users:update')

const held = computed(() => new Set<RoleId>(roles.assigned.value))

// A failure to load replaces the list; a failure to save sits under it, so the
// operator keeps what they were looking at and can try the toggle again.
const loadFailed = computed(() => Boolean(roles.error.value) && roles.available.value.length === 0)
const saveFailed = computed(() => Boolean(roles.error.value) && roles.available.value.length > 0)
const assignedRoles = computed<RoleRow[]>(() =>
  roles.available.value.filter((role) => held.value.has(role.id)),
)

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void roles.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  void roles.load()
}

function onToggle(roleId: RoleId, checked: boolean) {
  void (checked ? roles.assign(roleId) : roles.revoke(roleId))
}
</script>

<template>
  <section :class="sectionClasses">
    <Skeleton v-if="roles.loading.value" shape="block" :lines="3" />
    <ErrorState
      :title="$t('state-error-title')"
      v-else-if="loadFailed"
      :description="$t(roles.error.value ?? 'state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <EmptyState
      v-else-if="roles.available.value.length === 0"
      :title="$t('users-roles-empty-title')"
      :description="$t('users-roles-empty-body')"
    />
    <div v-else-if="canManage" :class="listClasses">
      <Checkbox
        v-for="role in roles.available.value"
        :key="role.id"
        :model-value="held.has(role.id)"
        :label="role.name"
        :description="role.description"
        :disabled="roles.saving.value"
        @update:model-value="onToggle(role.id, $event)"
      />
    </div>
    <div v-else :class="badgesClasses">
      <Badge v-for="role in assignedRoles" :key="role.id">{{ role.name }}</Badge>
    </div>
    <p v-if="saveFailed" :class="noticeClasses" role="alert">
      {{ $t(roles.error.value ?? 'state-error') }}
    </p>
  </section>
</template>
