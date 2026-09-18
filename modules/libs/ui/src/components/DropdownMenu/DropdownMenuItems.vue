<script setup lang="ts">
import { DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'

import { destructiveItemClasses, itemClasses, separatorClasses } from './styles'
import type { DropdownMenuItemData, DropdownMenuItemsEmits, DropdownMenuItemsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<DropdownMenuItemsProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<DropdownMenuItemsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('select', value)
}

/* -------------------------------- Helpers --------------------------------- */

function classesFor(item: DropdownMenuItemData) {
  return item.destructive ? [...itemClasses, ...destructiveItemClasses] : itemClasses
}
</script>

<template>
  <template v-for="item in props.items" :key="item.value">
    <DropdownMenuSeparator v-if="item.separatorBefore" :class="separatorClasses" />
    <DropdownMenuItem
      :class="classesFor(item)"
      :disabled="item.disabled"
      @select="onSelect(item.value)"
    >
      {{ item.label }}
    </DropdownMenuItem>
  </template>
</template>
