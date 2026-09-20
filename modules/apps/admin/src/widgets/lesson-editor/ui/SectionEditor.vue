<script setup lang="ts">
import type { BlockId, LessonBlock, LessonSection } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import { LessonBlockFrame } from '@/features/edit-lesson-content'

import { anchorOf, useBlockSorting } from '../lib'
import SectionHeader from './SectionHeader.vue'
import { blockListClasses, sectionClasses, tailClasses } from './styles'
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

// Only when the section does not already end in one: the empty text block shows
// this same line itself, and two of them would be two invitations to one place.
const tail = computed(() => {
  const last = props.section.blocks[props.section.blocks.length - 1]
  return !props.frozen && !(last?.type === 'text' && last.content.length === 0)
})

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

function onSectionInsert() {
  emit('section-insert', props.section.id)
}

function onTailWrite() {
  emit('tail-write', props.section.id)
}

// The line is a button until it is written in, and a slash on a button is a
// browser command: Firefox opens Quick Find with it. It belongs to the line the
// click would have opened, so it opens that line instead of reaching the chrome.
function onTailKey(event: KeyboardEvent) {
  if (event.key !== '/') return

  event.preventDefault()
  onTailWrite()
}

function onEnd(id: BlockId, kept: string) {
  emit('block-end', props.section.id, id, kept)
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
    <div :class="blockListClasses">
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
          @insert-section="onSectionInsert"
          @end="(kept) => onEnd(block.id, kept)"
          @move="onBlockMove(block.id, $event)"
          @duplicate="onBlockDuplicate(block.id)"
          @remove="onBlockRemove(block.id)"
        />
      </div>
      <button
        v-if="tail"
        type="button"
        :class="tailClasses"
        @click="onTailWrite"
        @keydown="onTailKey"
      >
        {{ $t('editor-text-placeholder') }}
      </button>
    </div>
  </section>
</template>
