<script setup lang="ts">
import type { BlockId, LessonBlock, LessonSection, SectionId } from '@vidya/domain'
import { AlertDialog, EmptyState } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { BlockType, MoveDirection } from '@/features/edit-lesson-content'
import {
  addBlock,
  addSection,
  BlockList,
  moveBlock,
  moveSection,
  removeBlock,
  removeSection,
  renameSection,
  SectionForm,
  SectionList,
  setSectionAssessment,
  updateBlock,
} from '@/features/edit-lesson-content'

import { blockColumnClasses, panesClasses, sectionColumnClasses } from './styles'
import type { LessonContentPanesEmits, LessonContentPanesProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonContentPanesProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonContentPanesEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const selectedId = ref<SectionId | undefined>(undefined)
const removing = ref<SectionId | undefined>(undefined)

const confirmOpen = ref(false)

const selected = computed<LessonSection | undefined>(() => sectionAt(selectedId.value))

/* -------------------------------- Handlers -------------------------------- */

function onSelect(id: SectionId) {
  selectedId.value = id
}

function onSectionAdd() {
  const next = addSection(props.content, $t('editor-section-new'))
  selectedId.value = next.sections[next.sections.length - 1]?.id
  emit('update:content', next)
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
  if (selectedId.value === id) selectedId.value = undefined
  emit('update:content', removeSection(props.content, id))
}

function onRemoveCancel() {
  confirmOpen.value = false
}

function onConfirmOpen(open: boolean) {
  confirmOpen.value = open
}

function onRename(id: SectionId, title: string) {
  emit('update:content', renameSection(props.content, id, title))
}

function onAssessment(id: SectionId, assessment: LessonSection['assessment']) {
  emit('update:content', setSectionAssessment(props.content, id, assessment))
}

function onBlockAdd(type: BlockType) {
  if (!selected.value) return
  emit('update:content', addBlock(props.content, selected.value.id, type))
}

function onBlockUpdate(block: LessonBlock) {
  if (!selected.value) return
  emit('update:content', updateBlock(props.content, selected.value.id, block))
}

function onBlockMove(id: BlockId, delta: MoveDirection) {
  if (!selected.value) return
  emit('update:content', moveBlock(props.content, selected.value.id, id, delta))
}

function onBlockRemove(id: BlockId) {
  if (!selected.value) return
  emit('update:content', removeBlock(props.content, selected.value.id, id))
}

/* -------------------------------- Helpers --------------------------------- */

// Falling back to the first section keeps a pane on screen after a deletion
// without inventing a selection the operator did not make.
function sectionAt(id: SectionId | undefined): LessonSection | undefined {
  return props.content.sections.find((section) => section.id === id) ?? props.content.sections[0]
}
</script>

<template>
  <div>
    <div :class="panesClasses">
      <SectionList
        :class="sectionColumnClasses"
        :sections="props.content.sections"
        :selected-id="selected?.id"
        :frozen="props.frozen"
        @select="onSelect"
        @add="onSectionAdd"
        @move="onSectionMove"
        @remove="onSectionRemove"
      />
      <div :class="blockColumnClasses">
        <SectionForm
          v-if="selected"
          :section="selected"
          :frozen="props.frozen"
          @rename="onRename"
          @assessment="onAssessment"
        />
        <BlockList
          v-if="selected"
          :blocks="selected.blocks"
          :frozen="props.frozen"
          @add="onBlockAdd"
          @update="onBlockUpdate"
          @move="onBlockMove"
          @remove="onBlockRemove"
        />
        <EmptyState
          v-else
          :title="$t('editor-no-section-title')"
          :description="$t('editor-no-section-body')"
        />
      </div>
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
