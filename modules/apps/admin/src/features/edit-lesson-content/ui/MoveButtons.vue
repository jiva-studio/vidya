<script setup lang="ts">
import { Button } from '@vidya/ui'
import { computed } from 'vue'

import { rowActionsClasses } from './styles'
import type { MoveButtonsEmits, MoveButtonsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MoveButtonsProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MoveButtonsEmits>()

/* --------------------------------- State ---------------------------------- */

const atTop = computed(() => props.index === 0)
const atBottom = computed(() => props.index >= props.count - 1)

/* -------------------------------- Handlers -------------------------------- */

function onUp() {
  emit('move', -1)
}

function onDown() {
  emit('move', 1)
}
</script>

<template>
  <span :class="rowActionsClasses">
    <Button size="sm" variant="ghost" :disabled="atTop" :aria-label="props.upLabel" @click="onUp">
      ↑
    </Button>
    <Button
      size="sm"
      variant="ghost"
      :disabled="atBottom"
      :aria-label="props.downLabel"
      @click="onDown"
    >
      ↓
    </Button>
  </span>
</template>
