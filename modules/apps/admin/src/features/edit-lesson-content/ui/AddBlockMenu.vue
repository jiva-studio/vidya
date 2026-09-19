<script setup lang="ts">
import { DropdownMenu } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { Plus } from 'lucide-vue-next'
import { computed } from 'vue'

import type { BlockType } from '../types'
import { BlockTypes } from '../types'
import { addTriggerClasses, iconClasses } from './styles'
import type { AddBlockMenuEmits, AddBlockMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AddBlockMenuProps>(), { label: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AddBlockMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const items = computed(() =>
  BlockTypes.map((value) => ({ value, label: $t(`editor-block-${value}`) })),
)

const name = computed(() => props.label ?? $t('editor-block-add'))

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('add', value as BlockType)
}
</script>

<template>
  <DropdownMenu
    :items="items"
    :label="name"
    :class="addTriggerClasses"
    align="start"
    @select="onSelect"
  >
    <template #trigger>
      <Plus :class="iconClasses" />
      <span>{{ name }}</span>
    </template>
  </DropdownMenu>
</template>
