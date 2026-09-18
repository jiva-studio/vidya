<script setup lang="ts">
import { Ellipsis } from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'

import DropdownMenuItems from './DropdownMenuItems.vue'
import { cn } from '../../lib/utils'
import { contentClasses, iconClasses, triggerClasses } from './styles'
import type { DropdownMenuEmits, DropdownMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DropdownMenuProps>(), {
  align: 'end',
  label: 'Row actions',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<DropdownMenuEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('select', value)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger :class="cn(triggerClasses, props.class)" :aria-label="props.label">
      <slot name="trigger">
        <Ellipsis :class="iconClasses" />
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :class="contentClasses" :align="props.align" :side-offset="4">
        <DropdownMenuItems :items="props.items" @select="onSelect" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
