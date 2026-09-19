<script setup lang="ts">
import type { BlockId, LessonBlock, LessonSection, SectionId } from '@vidya/domain'
import { AlertDialog, Button, EmptyState } from '@vidya/ui'
import { ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import {
  addBlock,
  addSection,
  moveBlock,
  moveSection,
  removeBlock,
  removeSection,
  renameSection,
  setSectionAssessment,
  updateBlock,
} from '@/features/edit-lesson-content'

import SectionEditor from './SectionEditor.vue'
import { addSectionClasses, documentClasses } from './styles'
import type { LessonDocumentEmits, LessonDocumentProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonDocumentProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonDocumentEmits>()

/* --------------------------------- State ---------------------------------- */

// The section just appended, so the caret lands in its title instead of leaving
// the author to hunt for the thing they asked for.
const fresh = ref<SectionId | undefined>(undefined)

const removing = ref<SectionId | undefined>(undefined)
const confirmOpen = ref(false)

/* -------------------------------- Handlers -------------------------------- */

function onSectionAdd() {
  const next = addSection(props.content, '')
  fresh.value = next.sections[next.sections.length - 1]?.id
  emit('update:content', next)
}

function onRename(id: SectionId, title: string) {
  emit('update:content', renameSection(props.content, id, title))
}

function onAssessment(id: SectionId, assessment: LessonSection['assessment']) {
  emit('update:content', setSectionAssessment(props.content, id, assessment))
}

function onSectionMove(id: SectionId, delta: MoveDirection) {
  emit('update:content', moveSection(props.content, id, delta))
}

function onSectionRemove(id: SectionId) {
  removing.value = id
  confirmOpen.value = true
}

// The pending id is not cleared by the dialog closing: the overlay and the
// confirm button both close it, and which of the two events lands first is
// reka's business rather than a rule this screen may depend on.
function onRemoveConfirm() {
  const id = removing.value
  confirmOpen.value = false
  if (!id) return
  emit('update:content', removeSection(props.content, id))
}

function onRemoveCancel() {
  confirmOpen.value = false
}

function onConfirmOpen(open: boolean) {
  confirmOpen.value = open
}

function onBlockAdd(id: SectionId, type: BlockType) {
  emit('update:content', addBlock(props.content, id, type))
}

function onBlockUpdate(id: SectionId, block: LessonBlock) {
  emit('update:content', updateBlock(props.content, id, block))
}

function onBlockMove(id: SectionId, blockId: BlockId, delta: MoveDirection) {
  emit('update:content', moveBlock(props.content, id, blockId, delta))
}

function onBlockRemove(id: SectionId, blockId: BlockId) {
  emit('update:content', removeBlock(props.content, id, blockId))
}
</script>

<template>
  <div :class="documentClasses">
    <EmptyState
      v-if="props.content.sections.length === 0"
      :title="$t('editor-sections-empty-title')"
      :description="$t('editor-sections-empty-body')"
    />
    <SectionEditor
      v-for="(section, index) in props.content.sections"
      :key="section.id"
      :section="section"
      :index="index"
      :count="props.content.sections.length"
      :frozen="props.frozen"
      :autofocus="section.id === fresh"
      @rename="onRename"
      @assessment="onAssessment"
      @move="onSectionMove"
      @remove="onSectionRemove"
      @block-add="onBlockAdd"
      @block-update="onBlockUpdate"
      @block-move="onBlockMove"
      @block-remove="onBlockRemove"
    />
    <div v-if="!props.frozen" :class="addSectionClasses">
      <Button variant="secondary" full-width @click="onSectionAdd">
        {{ $t('editor-section-add') }}
      </Button>
    </div>
    <AlertDialog
      :open="confirmOpen"
      :title="$t('editor-section-remove-title')"
      :description="$t('editor-section-remove-body')"
      :confirm-label="$t('editor-section-remove-submit')"
      :cancel-label="$t('editor-section-remove-cancel')"
      destructive
      @confirm="onRemoveConfirm"
      @cancel="onRemoveCancel"
      @update:open="onConfirmOpen"
    />
  </div>
</template>
