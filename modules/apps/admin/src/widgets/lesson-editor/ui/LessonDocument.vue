<script setup lang="ts">
import type {
  BlockId,
  LessonBlock,
  LessonContent,
  LessonSection,
  SectionId,
  TextBlock,
} from '@vidya/domain'
import { computed, ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import {
  addSection,
  blockBelow,
  convertBlock,
  duplicateBlock,
  insertBlockAfter,
  insertSectionAfter,
  moveBlock,
  moveSection,
  removeBlock,
  removeSection,
  renameSection,
  reorderBlocks,
  reorderSections,
  sectionBelow,
  setSectionAssessment,
  endTextBlock,
  updateBlock,
} from '@/features/edit-lesson-content'

import { focusAfterRemoval, useBlockSorting } from '../lib'
import SectionBoundary from './SectionBoundary.vue'
import SectionEditor from './SectionEditor.vue'
import { documentClasses } from './styles'
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

function onSectionAdd(afterId: SectionId | undefined) {
  const next = insertSectionAfter(shown.value, afterId)

  caretSection.value = sectionBelow(next, afterId)
  caretBlock.value = undefined
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
  // The line the author asked from is empty, so it is the line they meant.
  const blank = blankBlock(id, afterId)
  if (blank) {
    caretBlock.value = blank.id
    caretSection.value = undefined
    return apply(convertBlock(shown.value, id, blank.id, type))
  }

  const next = insertBlockAfter(shown.value, id, afterId, type)
  caretBlock.value = blockBelow(next, id, afterId)
  caretSection.value = undefined
  apply(next)
}

// The line an author asks for by clicking below the last block is the one they
// would have typed into: an empty one already there is that line, and opening a
// second would leave a blank behind them.
function onTailWrite(id: SectionId) {
  const blocks = blocksOf(id)
  const last = blocks[blocks.length - 1]
  const blank = blankBlock(id, last?.id)

  if (blank) {
    caretSection.value = undefined
    caretBlock.value = blank.id
    return
  }

  onBlockInsert(id, last?.id, 'text')
}

function onBlockEnd(id: SectionId, blockId: BlockId, kept: string) {
  const next = endTextBlock(shown.value, id, blockId, kept)

  caretBlock.value = blockBelow(next, id, blockId)
  caretSection.value = undefined
  apply(next)
}

function onBlockRemove(id: SectionId, blockId: BlockId) {
  caretBlock.value = focusAfterRemoval(blocksOf(id), blockId)
  caretSection.value = caretBlock.value ? undefined : id
  apply(removeBlock(shown.value, id, blockId))
}

/* -------------------------------- Helpers --------------------------------- */

function blocksOf(id: SectionId): readonly LessonBlock[] {
  return shown.value.sections.find((section) => section.id === id)?.blocks ?? []
}

/** The block, when it is a text line nobody has typed into yet. */
function blankBlock(id: SectionId, blockId: BlockId | undefined): TextBlock | undefined {
  const block = blocksOf(id).find((current) => current.id === blockId)
  return block?.type === 'text' && block.content.length === 0 ? block : undefined
}

// Every edit is made against what is on screen, which is the seeded section
// until the author writes something; from that first edit on, the document the
// parent holds is the one being changed.
function apply(next: LessonContent) {
  seed.value = next
  emit('update:content', next)
}
</script>

<template>
  <div ref="list" data-lesson-document :class="documentClasses">
    <template v-for="(section, index) in shown.sections" :key="section.id">
      <SectionEditor
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
        @section-insert="onSectionAdd"
        @tail-write="onTailWrite"
        @block-update="onBlockUpdate"
        @block-insert="onBlockInsert"
        @block-end="onBlockEnd"
        @block-move="onBlockMove"
        @block-duplicate="onBlockDuplicate"
        @block-remove="onBlockRemove"
      />
      <SectionBoundary v-if="!props.frozen" @add="onSectionAdd(section.id)" />
    </template>
  </div>
</template>
