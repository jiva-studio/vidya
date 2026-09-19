<script setup lang="ts">
import { Popover } from '@vidya/ui'
import { ref } from 'vue'

import type { BlockType } from '@/features/edit-lesson-content'
import { BlockInsertMenu } from '@/features/edit-lesson-content'

import { insertBarClasses } from './styles'
import type { SectionInsertBarEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionInsertBarEmits>()

/* --------------------------------- State ---------------------------------- */

const open = ref(false)

/* -------------------------------- Handlers -------------------------------- */

function onOpen(next: boolean) {
  open.value = next
}

function onPick(type: BlockType) {
  open.value = false
  emit('pick', type)
}

function onClose() {
  open.value = false
}
</script>

<template>
  <Popover :open="open" :label="$t('editor-block-add')" align="start" @update:open="onOpen">
    <template #trigger>
      <button type="button" :class="insertBarClasses">{{ $t('editor-block-add-here') }}</button>
    </template>
    <BlockInsertMenu @pick="onPick" @close="onClose" />
  </Popover>
</template>
