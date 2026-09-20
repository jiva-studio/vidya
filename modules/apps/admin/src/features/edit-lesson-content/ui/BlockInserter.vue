<script setup lang="ts">
import { Popover } from '@vidya/ui'
import { useFluent } from 'fluent-vue'

import type { BlockType } from '../types'
import BlockInsertMenu from './BlockInsertMenu.vue'
import { insertAnchorClasses } from './styles'
import type { BlockInserterEmits, BlockInserterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockInserterProps>(), { open: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockInserterEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

/* -------------------------------- Handlers -------------------------------- */

function onOpen(open: boolean) {
  emit('update:open', open)
}

function onPick(type: BlockType) {
  emit('pick', type)
}

function onSection() {
  emit('section')
}
</script>

<template>
  <Popover
    :open="props.open"
    :label="$t('editor-block-add')"
    side="bottom"
    align="start"
    @update:open="onOpen"
  >
    <template #trigger>
      <span :class="insertAnchorClasses" aria-hidden="true" />
    </template>
    <BlockInsertMenu @pick="onPick" @section="onSection" />
  </Popover>
</template>
