<script setup lang="ts">
import { Button } from '@vidya/ui'

import { menuClasses, menuItemClasses } from './styles'
import type { BlockMenuEmits, BlockMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<BlockMenuProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockMenuEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onUp() {
  emit('move', -1)
}

function onDown() {
  emit('move', 1)
}

function onDuplicate() {
  emit('duplicate')
}

function onRemove() {
  emit('remove')
}
</script>

<template>
  <div :class="menuClasses">
    <Button variant="ghost" :class="menuItemClasses" :disabled="props.first" @click="onUp">
      {{ $t('editor-move-up') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" :disabled="props.last" @click="onDown">
      {{ $t('editor-move-down') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" @click="onDuplicate">
      {{ $t('editor-duplicate') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" @click="onRemove">
      {{ $t('editor-delete') }}
    </Button>
  </div>
</template>
