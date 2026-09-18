<script setup lang="ts">
import type { BlockId, LessonBlock } from '@vidya/domain'

import type { BlockType, MoveDirection } from '../types'
import AddBlockMenu from './AddBlockMenu.vue'
import LessonBlockEditor from './LessonBlockEditor.vue'
import { addRowClasses, blocksClasses, hintClasses } from './styles'
import type { SectionBlocksEmits, SectionBlocksProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionBlocksProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionBlocksEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onAdd(type: BlockType) {
  emit('add', type)
}

function onUpdate(block: LessonBlock) {
  emit('update', block)
}

function onMove(id: BlockId, delta: MoveDirection) {
  emit('move', id, delta)
}

function onRemove(id: BlockId) {
  emit('remove', id)
}
</script>

<template>
  <div :class="blocksClasses">
    <LessonBlockEditor
      v-for="(block, index) in props.blocks"
      :key="block.id"
      :block="block"
      :index="index"
      :count="props.blocks.length"
      :frozen="props.frozen"
      @update="onUpdate"
      @move="onMove"
      @remove="onRemove"
    />
    <p v-if="props.frozen && props.blocks.length === 0" :class="hintClasses">
      {{ $t('editor-blocks-empty-body') }}
    </p>
    <div v-if="!props.frozen" :class="addRowClasses">
      <AddBlockMenu @add="onAdd" />
    </div>
  </div>
</template>
