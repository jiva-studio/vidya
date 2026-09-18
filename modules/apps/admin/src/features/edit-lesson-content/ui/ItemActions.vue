<script setup lang="ts">
import { IconButton } from '@vidya/ui'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'

import type { MoveDirection } from '../types'
import { actionsClasses, iconClasses } from './styles'
import type { ItemActionsEmits, ItemActionsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<ItemActionsProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ItemActionsEmits>()

/* --------------------------------- State ---------------------------------- */

const atTop = computed(() => props.index <= 0)
const atBottom = computed(() => props.index >= props.count - 1)

/* -------------------------------- Handlers -------------------------------- */

function onUp() {
  emit('move', -1 as MoveDirection)
}

function onDown() {
  emit('move', 1 as MoveDirection)
}

function onRemove() {
  emit('remove')
}
</script>

<template>
  <span :class="actionsClasses">
    <IconButton :label="props.upLabel" :disabled="atTop" @click="onUp">
      <ChevronUp :class="iconClasses" />
    </IconButton>
    <IconButton :label="props.downLabel" :disabled="atBottom" @click="onDown">
      <ChevronDown :class="iconClasses" />
    </IconButton>
    <IconButton :label="props.removeLabel" variant="danger" @click="onRemove">
      <Trash2 :class="iconClasses" />
    </IconButton>
  </span>
</template>
