<script setup lang="ts">
import { Button } from '@vidya/ui'
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'

import { useMenuKeys } from '../lib'

import { menuClasses, menuIconClasses, menuItemClasses } from './styles'
import type { BlockMenuEmits, BlockMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<BlockMenuProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const root = ref<HTMLElement | null>(null)

/* --------------------------------- Hooks ---------------------------------- */

const { onKey } = useMenuKeys(root)

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
  <div ref="root" :class="menuClasses" @keydown="onKey">
    <Button variant="ghost" :class="menuItemClasses" :disabled="props.first" @click="onUp">
      <ArrowUp :class="menuIconClasses" />
      {{ $t('editor-move-up') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" :disabled="props.last" @click="onDown">
      <ArrowDown :class="menuIconClasses" />
      {{ $t('editor-move-down') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" @click="onDuplicate">
      <Copy :class="menuIconClasses" />
      {{ $t('editor-duplicate') }}
    </Button>
    <Button variant="ghost" :class="menuItemClasses" @click="onRemove">
      <Trash2 :class="menuIconClasses" />
      {{ $t('editor-delete') }}
    </Button>
  </div>
</template>
