<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { Checkbox } from '@vidya/ui'
import { computed } from 'vue'

import { actionOf, groupPermissions } from '../model'
import { groupClasses, legendClasses, optionsClasses, pickerClasses } from './styles'
import type { PermissionGroup } from '../model'
import type { PermissionsPickerEmits, PermissionsPickerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PermissionsPickerProps>(), { disabled: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PermissionsPickerEmits>()

/* --------------------------------- State ---------------------------------- */

// Straight from @vidya/domain. A list of the admin's own would drift from the
// one the server checks against, and nobody would notice until a refusal.
const groups = computed<PermissionGroup[]>(() => groupPermissions())

const selected = computed(() => new Set<PermissionKey>(props.modelValue))

/* -------------------------------- Handlers -------------------------------- */

function onToggle(key: PermissionKey, checked: boolean) {
  emit('update:modelValue', checked ? withKey(key) : withoutKey(key))
}

/* -------------------------------- Helpers --------------------------------- */

function withKey(key: PermissionKey): PermissionKey[] {
  return selected.value.has(key) ? props.modelValue : [...props.modelValue, key]
}

function withoutKey(key: PermissionKey): PermissionKey[] {
  return props.modelValue.filter((held) => held !== key)
}

function groupLabel(group: PermissionGroup): string {
  return `permission-group-${group.prefix}`
}

function actionLabel(key: PermissionKey): string {
  return `permission-action-${actionOf(key)}`
}
</script>

<template>
  <div :class="pickerClasses">
    <fieldset v-for="group in groups" :key="group.prefix" :class="groupClasses">
      <legend :class="legendClasses">{{ $t(groupLabel(group)) }}</legend>
      <div :class="optionsClasses">
        <Checkbox
          v-for="key in group.keys"
          :key="key"
          :model-value="selected.has(key)"
          :label="$t(actionLabel(key))"
          :disabled="props.disabled"
          @update:model-value="onToggle(key, $event)"
        />
      </div>
    </fieldset>
  </div>
</template>
