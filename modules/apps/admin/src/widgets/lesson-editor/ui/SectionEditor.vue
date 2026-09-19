<script setup lang="ts">
import type { BlockId, LessonBlock, LessonSection } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import { LessonBlockFrame } from '@/features/edit-lesson-content'

import { anchorOf, useBlockSorting } from '../lib'
import SectionHeader from './SectionHeader.vue'
import SectionInsertBar from './SectionInsertBar.vue'
import { blockListClasses, sectionClasses } from './styles'
import type { SectionEditorEmits, SectionEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionEditorProps>(), {
  frozen: false,
  autofocus: false,
  caret: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const list = ref<HTMLElement | null>(null)

const anchor = computed(() => anchorOf(props.section.id))
const name = computed(() => props.section.title.trim() || $t('editor-section-untitled'))
const last = computed(() => props.section.blocks[props.section.blocks.length - 1]?.id)

/* --------------------------------- Hooks ---------------------------------- */

useBlockSorting(list, onReorder, '[data-block-handle]')

/* -------------------------------- Handlers -------------------------------- */

function onReorder(from: number, to: number) {
  emit('reorder', props.section.id, from, to)
}

function onRename(title: string) {
  emit('rename', props.section.id, title)
}

function onAssessment(assessment: LessonSection['assessment']) {
  emit('assessment', props.section.id, assessment)
}

function onMove(delta: MoveDirection) {
  emit('move', props.section.id, delta)
}

function onRemove() {
  emit('remove', props.section.id)
}

function onBlockUpdate(block: LessonBlock) {
  emit('block-update', props.section.id, block)
}

function onBlockMove(id: BlockId, delta: MoveDirection) {
  emit('block-move', props.section.id, id, delta)
}

function onBlockDuplicate(id: BlockId) {
  emit('block-duplicate', props.section.id, id)
}

function onBlockRemove(id: BlockId) {
  emit('block-remove', props.section.id, id)
}

function onBlockInsert(id: BlockId | undefined, type: BlockType) {
  emit('block-insert', props.section.id, id, type)
}

function onTailInsert(type: BlockType) {
  onBlockInsert(last.value, type)
}
</script>

<template>
  <section :id="anchor" :class="sectionClasses" :aria-label="name">
    <SectionHeader
      :section="props.section"
      :frozen="props.frozen"
      :autofocus="props.autofocus"
      :first="props.first"
      :last="props.last"
      @rename="onRename"
      @assessment="onAssessment"
      @move="onMove"
      @remove="onRemove"
    />
    <div ref="list" :class="blockListClasses">
      <LessonBlockFrame
        v-for="(block, index) in props.section.blocks"
        :key="block.id"
        :block="block"
        :frozen="props.frozen"
        :first="index === 0"
        :last="index === props.section.blocks.length - 1"
        :autofocus="block.id === props.caret"
        @update="onBlockUpdate"
        @insert="onBlockInsert(block.id, $event)"
        @move="onBlockMove(block.id, $event)"
        @duplicate="onBlockDuplicate(block.id)"
        @remove="onBlockRemove(block.id)"
      />
    </div>
    <SectionInsertBar v-if="!props.frozen" @pick="onTailInsert" />
  </section>
</template>
