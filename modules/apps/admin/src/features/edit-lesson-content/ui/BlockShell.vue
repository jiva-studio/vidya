<script setup lang="ts">
import type { MoveDirection } from '../types'
import ItemActions from './ItemActions.vue'
import { blockBodyClasses, blockShellClasses } from './styles'
import type { BlockShellEmits, BlockShellProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockShellProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockShellEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onMove(delta: MoveDirection) {
  emit('move', delta)
}

function onRemove() {
  emit('remove')
}
</script>

<template>
  <div :class="blockShellClasses">
    <div :class="blockBodyClasses">
      <slot />
    </div>
    <ItemActions
      v-if="!props.frozen"
      :index="props.index"
      :count="props.count"
      :up-label="$t('editor-block-up', { block: props.label })"
      :down-label="$t('editor-block-down', { block: props.label })"
      :remove-label="$t('editor-block-remove', { block: props.label })"
      @move="onMove"
      @remove="onRemove"
    />
  </div>
</template>
