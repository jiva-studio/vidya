<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { Switch } from '@vidya/ui'
import { computed, ref } from 'vue'

import type { PermissionGroup } from '../model'
import {
  WILDCARD_GROUP,
  groupPermissions,
  splitGroups,
  toggleGroup,
  togglePermission,
} from '../model'
import PermissionGroupFields from './PermissionGroupFields.vue'
import {
  columnClasses,
  columnsClasses,
  noticeClasses,
  pickerClasses,
  wildcardClasses,
} from './styles'
import type { PermissionsPickerEmits, PermissionsPickerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PermissionsPickerProps>(), {
  disabled: false,
  readonly: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PermissionsPickerEmits>()

/* --------------------------------- State ---------------------------------- */

const groups = computed(() => groupPermissions().filter((group) => group.prefix !== WILDCARD_GROUP))

const columns = computed(() => splitGroups(groups.value))

const grantedAll = computed(() => props.modelValue.includes('*'))

const locked = computed(() => props.disabled || props.readonly)

const setAside = ref<PermissionKey[]>([])

/* -------------------------------- Handlers -------------------------------- */

function onGrantAll(on: boolean) {
  if (on) setAside.value = props.modelValue

  emit('update:modelValue', on ? (['*'] as PermissionKey[]) : setAside.value)
}

function onToggle(key: PermissionKey, on: boolean) {
  emit('update:modelValue', togglePermission(props.modelValue, key, on))
}

function onToggleGroup(group: PermissionGroup, on: boolean) {
  emit('update:modelValue', toggleGroup(props.modelValue, group, on))
}
</script>

<template>
  <div :class="pickerClasses">
    <Switch
      :model-value="grantedAll"
      :label="$t('permission-action-all')"
      :description="$t('permission-all-hint')"
      :disabled="locked"
      :class="wildcardClasses"
      @update:model-value="onGrantAll"
    />
    <p v-if="grantedAll" :class="noticeClasses">{{ $t('permission-all-notice') }}</p>
    <div v-else :class="columnsClasses">
      <div v-for="(column, index) in columns" :key="index" :class="columnClasses">
        <PermissionGroupFields
          v-for="group in column"
          :key="group.prefix"
          :group="group"
          :held="props.modelValue"
          :disabled="locked"
          @toggle="onToggle"
          @toggle-group="onToggleGroup"
        />
      </div>
    </div>
  </div>
</template>
