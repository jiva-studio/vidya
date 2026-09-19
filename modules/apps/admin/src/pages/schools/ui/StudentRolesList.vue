<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import { Checkbox } from '@vidya/ui'

import { listClasses } from './styles'
import type { StudentRolesListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<StudentRolesListProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ toggle: [id: RoleId, checked: boolean] }>()

/* -------------------------------- Handlers -------------------------------- */

function onToggle(id: RoleId, checked: boolean) {
  emit('toggle', id, checked)
}
</script>

<template>
  <div :class="listClasses">
    <Checkbox
      v-for="role in props.roles"
      :key="role.id"
      :model-value="props.chosen.includes(role.id)"
      :label="role.name"
      :disabled="props.disabled"
      @update:model-value="onToggle(role.id, $event)"
    />
  </div>
</template>
