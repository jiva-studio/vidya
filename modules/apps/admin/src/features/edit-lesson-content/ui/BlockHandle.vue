<script setup lang="ts">
import { Popover } from '@vidya/ui'
import { GripVertical } from 'lucide-vue-next'

import type { MoveDirection } from '../types'
import BlockMenu from './BlockMenu.vue'
import { gutterButtonClasses, iconClasses } from './styles'
import type { BlockHandleEmits, BlockHandleProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockHandleProps>(), { open: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockHandleEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpen(open: boolean) {
  emit('update:open', open)
}

// Preventing the default is what keeps this from firing twice: a browser turns
// Enter on a focused button into a click, which the trigger would toggle on.
function onEnter() {
  emit('update:open', true)
}

function onMove(delta: MoveDirection) {
  emit('move', delta)
}

function onDuplicate() {
  emit('duplicate')
}

function onRemove() {
  emit('remove')
}
</script>

<template>
  <Popover :open="props.open" :label="props.label" side="left" @update:open="onOpen">
    <template #trigger>
      <button
        type="button"
        data-block-handle
        :aria-label="props.label"
        :class="gutterButtonClasses"
        @keydown.enter.prevent="onEnter"
      >
        <GripVertical :class="iconClasses" />
      </button>
    </template>
    <BlockMenu
      :first="props.first"
      :last="props.last"
      @move="onMove"
      @duplicate="onDuplicate"
      @remove="onRemove"
    />
  </Popover>
</template>
