<script setup lang="ts">
import { CommandMenu } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { BlockType } from '../types'
import { BlockTypes } from '../types'
import type { BlockInsertMenuEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockInsertMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const term = ref('')

const items = computed(() =>
  BlockTypes.map((value) => ({ value, label: $t(`editor-block-${value}`) })),
)

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('pick', value as BlockType)
}

function onTerm(next: string) {
  term.value = next
}

function onClose() {
  emit('close')
}
</script>

<template>
  <CommandMenu
    :items="items"
    :term="term"
    :label="$t('editor-block-add')"
    :placeholder="$t('editor-block-search')"
    :empty-label="$t('editor-block-none')"
    @select="onSelect"
    @update:term="onTerm"
    @close="onClose"
  />
</template>
