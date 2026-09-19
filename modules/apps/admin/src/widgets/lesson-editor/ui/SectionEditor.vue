<script setup lang="ts">
import type { BlockId, LessonBlock, LessonSection, SectionId } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import { ItemActions, SectionBlocks, SectionForm } from '@/features/edit-lesson-content'

import { anchorOf } from '../lib'
import { sectionClasses } from './styles'
import type { SectionEditorEmits, SectionEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionEditorProps>(), {
  frozen: false,
  autofocus: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const anchor = computed(() => anchorOf(props.section.id))
const name = computed(() => props.section.title.trim() || $t('editor-section-untitled'))

/* -------------------------------- Handlers -------------------------------- */

function onRename(id: SectionId, title: string) {
  emit('rename', id, title)
}

function onAssessment(id: SectionId, assessment: LessonSection['assessment']) {
  emit('assessment', id, assessment)
}

function onMove(delta: MoveDirection) {
  emit('move', props.section.id, delta)
}

function onRemove() {
  emit('remove', props.section.id)
}

function onBlockAdd(type: BlockType) {
  emit('block-add', props.section.id, type)
}

function onBlockUpdate(block: LessonBlock) {
  emit('block-update', props.section.id, block)
}

function onBlockMove(blockId: BlockId, delta: MoveDirection) {
  emit('block-move', props.section.id, blockId, delta)
}

function onBlockRemove(blockId: BlockId) {
  emit('block-remove', props.section.id, blockId)
}
</script>

<template>
  <article :id="anchor" :class="sectionClasses" :aria-label="name">
    <SectionForm
      :section="props.section"
      :frozen="props.frozen"
      :autofocus="props.autofocus"
      @rename="onRename"
      @assessment="onAssessment"
    >
      <template #actions>
        <ItemActions
          v-if="!props.frozen"
          :index="props.index"
          :count="props.count"
          :up-label="$t('editor-section-up')"
          :down-label="$t('editor-section-down')"
          :remove-label="$t('editor-section-remove')"
          @move="onMove"
          @remove="onRemove"
        />
      </template>
    </SectionForm>
    <SectionBlocks
      :blocks="props.section.blocks"
      :frozen="props.frozen"
      @add="onBlockAdd"
      @update="onBlockUpdate"
      @move="onBlockMove"
      @remove="onBlockRemove"
    />
  </article>
</template>
