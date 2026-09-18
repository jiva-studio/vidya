<script setup lang="ts">
import type { SectionId } from '@vidya/domain'
import { Button, EmptyState } from '@vidya/ui'

import type { MoveDirection } from '../types'
import SectionListRow from './SectionListRow.vue'
import { sectionListClasses, sectionRowsClasses } from './styles'
import type { SectionListEmits, SectionListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionListProps>(), {
  frozen: false,
  selectedId: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionListEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(id: SectionId) {
  emit('select', id)
}

function onMove(id: SectionId, delta: MoveDirection) {
  emit('move', id, delta)
}

function onRemove(id: SectionId) {
  emit('remove', id)
}

function onAdd() {
  emit('add')
}
</script>

<template>
  <nav :class="sectionListClasses" :aria-label="$t('editor-sections-label')">
    <EmptyState
      v-if="props.sections.length === 0"
      :title="$t('editor-sections-empty-title')"
      :description="$t('editor-sections-empty-body')"
      :action-label="props.frozen ? undefined : $t('editor-sections-empty-action')"
      @action="onAdd"
    />
    <ul v-else :class="sectionRowsClasses">
      <li v-for="(section, index) in props.sections" :key="section.id">
        <SectionListRow
          :section="section"
          :index="index"
          :count="props.sections.length"
          :selected="section.id === props.selectedId"
          :frozen="props.frozen"
          @select="onSelect"
          @move="onMove"
          @remove="onRemove"
        />
      </li>
    </ul>
    <Button v-if="!props.frozen" size="sm" variant="secondary" @click="onAdd">
      {{ $t('editor-section-add') }}
    </Button>
  </nav>
</template>
