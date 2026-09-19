<script setup lang="ts">
import type { BlockId, LessonBlock, LessonContent, LessonSection, SectionId } from '@vidya/domain'
import { computed, ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import {
  addSection,
  blockBelow,
  duplicateBlock,
  insertBlockAfter,
  moveBlock,
  moveSection,
  removeBlock,
  removeSection,
  renameSection,
  reorderBlocks,
  reorderSections,
  setSectionAssessment,
  updateBlock,
} from '@/features/edit-lesson-content'

import { focusAfterRemoval, useBlockSorting } from '../lib'
import SectionEditor from './SectionEditor.vue'
import { addSectionClasses, documentClasses } from './styles'
import type { LessonDocumentEmits, LessonDocumentProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonDocumentProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonDocumentEmits>()

/* --------------------------------- State ---------------------------------- */

const list = ref<HTMLElement | null>(null)

// A lesson with nothing in it still needs a line to type into, so the section
// comes with one. Neither is emitted on its own: they reach the server only
// once an edit is made through them, so a lesson opened and closed again is
// still an empty lesson.
const seed = ref<LessonContent>(seeded())

const caretBlock = ref<BlockId | undefined>(undefined)
const caretSection = ref<SectionId | undefined>(undefined)

const shown = computed(() => (props.content.sections.length > 0 ? props.content : seed.value))

/* --------------------------------- Hooks ---------------------------------- */

useBlockSorting(list, onSectionReorder, '[data-section-handle]')

/* -------------------------------- Helpers --------------------------------- */

function seeded(): LessonContent {
  const withSection = addSection({ ...props.content, sections: [] }, '')
  const section = withSection.sections[0]
  return insertBlockAfter(withSection, section.id, undefined, 'text')
}

/* -------------------------------- Handlers -------------------------------- */

function onSectionAdd() {
  const next = addSection(shown.value, '')

  caretSection.value = next.sections[next.sections.length - 1]?.id
  apply(next)
}

function onRename(id: SectionId, title: string) {
  apply(renameSection(shown.value, id, title))
}

function onAssessment(id: SectionId, assessment: LessonSection['assessment']) {
  apply(setSectionAssessment(shown.value, id, assessment))
}

function onSectionMove(id: SectionId, delta: MoveDirection) {
  apply(moveSection(shown.value, id, delta))
}

function onSectionReorder(from: number, to: number) {
  apply(reorderSections(shown.value, from, to))
}

function onSectionRemove(id: SectionId) {
  const at = shown.value.sections.findIndex((section) => section.id === id)
  const next = shown.value.sections[at + 1] ?? shown.value.sections[at - 1]

  caretSection.value = next?.id
  apply(removeSection(shown.value, id))
}

function onBlockUpdate(id: SectionId, block: LessonBlock) {
  apply(updateBlock(shown.value, id, block))
}

function onBlockMove(id: SectionId, blockId: BlockId, delta: MoveDirection) {
  apply(moveBlock(shown.value, id, blockId, delta))
}

function onBlockReorder(id: SectionId, from: number, to: number) {
  apply(reorderBlocks(shown.value, id, from, to))
}

function onBlockDuplicate(id: SectionId, blockId: BlockId) {
  const next = duplicateBlock(shown.value, id, blockId)
  caretBlock.value = blockBelow(next, id, blockId)
  apply(next)
}

function onBlockInsert(id: SectionId, afterId: BlockId | undefined, type: BlockType) {
  const next = insertBlockAfter(shown.value, id, afterId, type)
  caretBlock.value = blockBelow(next, id, afterId)
  caretSection.value = undefined
  apply(next)
}

function onBlockRemove(id: SectionId, blockId: BlockId) {
  const blocks = shown.value.sections.find((section) => section.id === id)?.blocks ?? []

  caretBlock.value = focusAfterRemoval(blocks, blockId)
  caretSection.value = caretBlock.value ? undefined : id
  apply(removeBlock(shown.value, id, blockId))
}

/* -------------------------------- Helpers --------------------------------- */

// Every edit is made against what is on screen, which is the seeded section
// until the author writes something; from that first edit on, the document the
// parent holds is the one being changed.
function apply(next: LessonContent) {
  seed.value = next
  emit('update:content', next)
}
</script>

<template>
  <div ref="list" :class="documentClasses">
    <SectionEditor
      v-for="(section, index) in shown.sections"
      :key="section.id"
      :section="section"
      :frozen="props.frozen"
      :first="index === 0"
      :last="index === shown.sections.length - 1"
      :autofocus="section.id === caretSection"
      :caret="caretBlock"
      @rename="onRename"
      @assessment="onAssessment"
      @move="onSectionMove"
      @reorder="onBlockReorder"
      @remove="onSectionRemove"
      @block-update="onBlockUpdate"
      @block-insert="onBlockInsert"
      @block-move="onBlockMove"
      @block-duplicate="onBlockDuplicate"
      @block-remove="onBlockRemove"
    />
    <button v-if="!props.frozen" type="button" :class="addSectionClasses" @click="onSectionAdd">
      {{ $t('editor-section-add') }}
    </button>
  </div>
</template>
