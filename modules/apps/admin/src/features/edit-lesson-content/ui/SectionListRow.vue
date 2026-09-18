<script setup lang="ts">
import { Button } from '@vidya/ui'
import { computed } from 'vue'

import type { MoveDirection } from '../types'
import MoveButtons from './MoveButtons.vue'
import {
  rowActionsClasses,
  sectionRowClasses,
  sectionRowSelectedClasses,
  sectionRowTitleClasses,
} from './styles'
import type { SectionListRowEmits, SectionListRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionListRowProps>(), { frozen: false, selected: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionListRowEmits>()

/* --------------------------------- State ---------------------------------- */

const rowClasses = computed(() => [
  ...sectionRowClasses,
  ...(props.selected ? sectionRowSelectedClasses : []),
])

const title = computed(() => props.section.title.trim())

/* -------------------------------- Handlers -------------------------------- */

function onSelect() {
  emit('select', props.section.id)
}

function onMove(delta: MoveDirection) {
  emit('move', props.section.id, delta)
}

function onRemove() {
  emit('remove', props.section.id)
}
</script>

<template>
  <div :class="rowClasses">
    <button
      type="button"
      :class="sectionRowTitleClasses"
      :aria-current="props.selected || undefined"
      @click="onSelect"
    >
      {{ title || $t('editor-section-untitled') }}
    </button>
    <span v-if="!props.frozen" :class="rowActionsClasses">
      <MoveButtons
        :index="props.index"
        :count="props.count"
        :up-label="$t('editor-section-up')"
        :down-label="$t('editor-section-down')"
        @move="onMove"
      />
      <Button size="sm" variant="ghost" @click="onRemove">
        {{ $t('editor-section-remove') }}
      </Button>
    </span>
  </div>
</template>
