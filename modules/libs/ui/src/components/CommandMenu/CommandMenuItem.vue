<script setup lang="ts">
import { ListboxItem } from 'reka-ui'

import {
  iconClasses,
  itemClasses,
  itemDescriptionClasses,
  itemLabelClasses,
  itemTextClasses,
} from './styles'
import type { CommandMenuItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CommandMenuItemProps>()
</script>

<template>
  <ListboxItem :value="props.item.value" :disabled="props.item.disabled" :class="itemClasses">
    <component :is="props.item.icon" v-if="props.item.icon" :class="iconClasses" />
    <span :class="itemTextClasses">
      <span :class="itemLabelClasses">{{ props.item.label }}</span>
      <span v-if="props.item.description" :class="itemDescriptionClasses">
        {{ props.item.description }}
      </span>
    </span>
  </ListboxItem>
</template>
