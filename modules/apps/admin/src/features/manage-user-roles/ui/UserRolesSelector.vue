<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import { Badge, Checkbox, EmptyState, FailureState, Skeleton } from '@vidya/ui'
import { computed } from 'vue'

import type { RoleRow } from '@/entities/role'
import { useCan } from '@/shared/access'

import type { UserRolesSelectorEmits, UserRolesSelectorProps } from '../types'
import { badgesClasses, listClasses, noticeClasses, sectionClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<UserRolesSelectorProps>(), {
  loading: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<UserRolesSelectorEmits>()

/* --------------------------------- State ---------------------------------- */

// Hidden rather than disabled: a control nobody can explain is worse than no
// control at all. The server refuses either way.
const canManage = useCan('users:update')

const held = computed(() => new Set<RoleId>(props.selected))

// A failure to load replaces the list; a failure to save sits under it, so the
// operator keeps what they were looking at and can try again.
const loadFailed = computed(() => Boolean(props.error) && props.available.length === 0)
const saveFailed = computed(() => Boolean(props.error) && props.available.length > 0)
const assignedRoles = computed<RoleRow[]>(() =>
  props.available.filter((role) => held.value.has(role.id)),
)

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}

function onToggle(roleId: RoleId, checked: boolean) {
  emit('toggle', roleId, checked)
}
</script>

<template>
  <section :class="sectionClasses">
    <Skeleton v-if="props.loading" shape="block" :lines="3" />
    <FailureState
      v-else-if="loadFailed"
      :title="$t('state-error-title')"
      :description="$t(props.error ?? 'state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <EmptyState
      v-else-if="props.available.length === 0"
      :title="$t('users-roles-empty-title')"
      :description="$t('users-roles-empty-body')"
    />
    <div v-else-if="canManage" :class="listClasses">
      <Checkbox
        v-for="role in props.available"
        :key="role.id"
        :model-value="held.has(role.id)"
        :label="role.name"
        :description="role.description"
        @update:model-value="onToggle(role.id, $event)"
      />
    </div>
    <div v-else :class="badgesClasses">
      <Badge v-for="role in assignedRoles" :key="role.id">{{ role.name }}</Badge>
    </div>
    <p v-if="saveFailed" :class="noticeClasses" role="alert">
      {{ $t(props.error ?? 'state-error') }}
    </p>
  </section>
</template>
