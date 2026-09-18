<script setup lang="ts">
import type { BlockId, LessonBlock } from '@vidya/domain'
import { Button, EmptyState } from '@vidya/ui'

import type { BlockType, MoveDirection } from '../types'
import { BlockTypes } from '../types'
import BlockListItem from './BlockListItem.vue'
import { addBlockBarClasses, blockListClasses } from './styles'
import type { BlockListEmits, BlockListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockListProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockListEmits>()

/* --------------------------------- State ---------------------------------- */

const types = BlockTypes

/* -------------------------------- Handlers -------------------------------- */

function onAdd(type: BlockType) {
  emit('add', type)
}

function onFirst() {
  emit('add', 'text')
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
  <div :class="blockListClasses">
    <EmptyState
      v-if="props.blocks.length === 0"
      :title="$t('editor-blocks-empty-title')"
      :description="$t('editor-blocks-empty-body')"
      :action-label="props.frozen ? undefined : $t('editor-blocks-empty-action')"
      @action="onFirst"
    />
    <BlockListItem
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
    <div v-if="!props.frozen" :class="addBlockBarClasses">
      <Button v-for="type in types" :key="type" size="sm" variant="secondary" @click="onAdd(type)">
        {{ $t(`editor-block-add-${type}`) }}
      </Button>
    </div>
  </div>
</template>
