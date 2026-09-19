<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { Checkbox } from '@vidya/ui'
import { computed } from 'vue'

import { actionOf, groupState } from '../model'
import { groupClasses, groupNameClasses, optionsClasses } from './styles'
import type { PermissionGroupFieldsEmits, PermissionGroupFieldsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PermissionGroupFieldsProps>(), { disabled: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PermissionGroupFieldsEmits>()

/* --------------------------------- State ---------------------------------- */

const state = computed(() => groupState(props.group, props.held))

const whole = computed(() => state.value === 'all')

const partial = computed(() => state.value === 'some')

/* -------------------------------- Handlers -------------------------------- */

function onWhole(on: boolean) {
  emit('toggle-group', props.group, on)
}

function onOne(key: PermissionKey, on: boolean) {
  emit('toggle', key, on)
}

/* -------------------------------- Helpers --------------------------------- */

function isHeld(key: PermissionKey): boolean {
  return props.held.includes(key)
}
</script>

<template>
  <div :class="groupClasses">
    <Checkbox
      :data-permission-group="props.group.prefix"
      :model-value="whole"
      :indeterminate="partial"
      :label="$t(`permission-group-${props.group.prefix}`)"
      :disabled="props.disabled"
      :class="groupNameClasses"
      @update:model-value="onWhole"
    />
    <div :class="optionsClasses">
      <Checkbox
        v-for="key in props.group.keys"
        :key="key"
        :data-permission="key"
        :model-value="isHeld(key)"
        :label="$t(`permission-action-${actionOf(key)}`)"
        :disabled="props.disabled"
        @update:model-value="onOne(key, $event)"
      />
    </div>
  </div>
</template>
