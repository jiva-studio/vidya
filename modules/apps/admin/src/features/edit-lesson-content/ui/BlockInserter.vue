<script setup lang="ts">
import { Popover } from '@vidya/ui'
import { Plus } from 'lucide-vue-next'

import type { BlockType } from '../types'
import BlockInsertMenu from './BlockInsertMenu.vue'
import { gutterButtonClasses, iconClasses } from './styles'
import type { BlockInserterEmits, BlockInserterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockInserterProps>(), { open: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockInserterEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpen(open: boolean) {
  emit('update:open', open)
}

function onEnter() {
  emit('update:open', true)
}

function onPick(type: BlockType) {
  emit('pick', type)
}

function onClose() {
  emit('update:open', false)
}
</script>

<template>
  <Popover :open="props.open" :label="props.label" side="left" @update:open="onOpen">
    <template #trigger>
      <button
        type="button"
        :aria-label="props.label"
        :class="gutterButtonClasses"
        @keydown.enter.prevent="onEnter"
      >
        <Plus :class="iconClasses" />
      </button>
    </template>
    <BlockInsertMenu @pick="onPick" @close="onClose" />
  </Popover>
</template>
