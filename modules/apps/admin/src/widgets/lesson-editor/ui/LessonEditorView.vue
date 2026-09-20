<script setup lang="ts">
import type { LessonContent, SectionId } from '@vidya/domain'
import { FailureState, Skeleton } from '@vidya/ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { BlockFault } from '@/features/edit-lesson-content'
import {
  findBlockFaults,
  contentProblems,
  pruneForSave,
  useLessonContentEditor,
} from '@/features/edit-lesson-content'
import { PublishDialog } from '@/features/publish-lesson'
import { useCan } from '@/shared/access'

import { anchorOf } from '../lib'
import {
  useAutosave,
  useDraftSaving,
  useEditorShortcuts,
  useLessonPublishing,
  useLessonVersionDocument,
} from '../model'
import ContentProblemsNotice from './ContentProblemsNotice.vue'
import EditorToolbar from './EditorToolbar.vue'
import LessonDocument from './LessonDocument.vue'
import { editorClasses } from './styles'
import type { LessonEditorViewEmits, LessonEditorViewProps } from './types'
import UnsavedChangesGuard from './UnsavedChangesGuard.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonEditorViewProps>(), { title: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonEditorViewEmits>()

/* --------------------------------- State ---------------------------------- */

const versionDoc = useLessonVersionDocument(props.lessonId)
const editor = useLessonContentEditor()
const draft = useDraftSaving(props.lessonId)
const publishing = useLessonPublishing(props.lessonId)
const autosave = useAutosave(send)

const publishable = useCan('lessons:publish')
const publishOpen = ref(false)
const faults = ref<BlockFault[]>([])

const frozen = computed(() => versionDoc.version.value?.status === 'published')
const problems = computed(() => contentProblems(editor.content.value))
const blocked = computed(() => problems.value.length > 0)
const noticed = computed(() => blocked.value || faults.value.length > 0)

/* --------------------------------- Hooks ---------------------------------- */

// A reopened version replaces what is on screen only when nothing is unsaved:
// an edit the server refused exists nowhere else.
watch(versionDoc.version, (version) => {
  if (version && !editor.dirty.value) editor.load(version.content)
})

useEditorShortcuts({ undo: onUndo, redo: onRedo, save: onSave })

onMounted(() => {
  void versionDoc.open()
})

/* -------------------------------- Handlers -------------------------------- */

function onContent(content: LessonContent) {
  editor.set(content)
  queue()
}

function onUndo() {
  editor.undo()
  queue()
}

function onRedo() {
  editor.redo()
  queue()
}

function onBack() {
  emit('back')
}

function onRename(title: string) {
  emit('rename', title)
}

function onRetry() {
  void versionDoc.open()
}

function onSaveRetry() {
  void autosave.retry()
}

function onPublish() {
  faults.value = findBlockFaults(editor.content.value)
  const first = faults.value.at(0)

  if (first) reveal(first.sectionId)
  else publishOpen.value = true
}

function onPublishOpen(open: boolean) {
  publishOpen.value = open
}

function onSave() {
  void autosave.flush()
}

// Publishing freezes what the server holds, so anything still on screen has to
// reach it first; a failed save stops the publish rather than freezing an old text.
async function onPublishConfirm() {
  const version = versionDoc.version.value
  if (!version) return
  if (!(await autosave.flush())) return
  if (!(await publishing.publish(version.id))) return

  publishOpen.value = false
  await versionDoc.open(version.id)
}

async function onRevision() {
  const opened = await publishing.openRevision()
  if (opened) await versionDoc.open(opened)
}

/* -------------------------------- Helpers --------------------------------- */

function queue() {
  faults.value = []
  if (!frozen.value && !blocked.value) autosave.schedule(editor.content.value)
}

// The save carries the snapshot it was given, and the answer clears the dirty
// flag against that snapshot alone — whatever was typed since stays unsaved.
async function send(content: LessonContent): Promise<boolean> {
  const version = versionDoc.version.value
  if (!version || frozen.value || blocked.value) return false

  const stored = await draft.save(version.id, pruneForSave(content))
  if (stored) editor.markSaved(content)
  return stored
}

function reveal(id: SectionId) {
  document.getElementById(anchorOf(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section :class="editorClasses">
    <EditorToolbar
      :title="props.title"
      :version="versionDoc.version.value?.version"
      :frozen="frozen"
      :dirty="editor.dirty.value"
      :status="autosave.status.value"
      :busy="publishing.busy.value"
      :publishable="publishable"
      :blocked="blocked"
      @rename="onRename"
      @back="onBack"
      @save="onSave"
      @retry="onSaveRetry"
      @publish="onPublish"
      @revision="onRevision"
    />
    <ContentProblemsNotice v-if="noticed" :problems="problems" :faults="faults" />
    <Skeleton v-if="versionDoc.loading.value" shape="block" />
    <FailureState
      v-else-if="versionDoc.error.value"
      :title="$t('state-error-title')"
      :description="$t('state-error')"
      :retry-label="$t('editor-retry')"
      @retry="onRetry"
    />
    <LessonDocument
      v-else
      :content="editor.content.value"
      :frozen="frozen"
      @update:content="onContent"
    />
    <PublishDialog
      :open="publishOpen"
      :version="versionDoc.version.value?.version ?? 0"
      :busy="publishing.busy.value"
      :error="publishing.error.value && $t(publishing.error.value)"
      @update:open="onPublishOpen"
      @confirm="onPublishConfirm"
    />
    <UnsavedChangesGuard :dirty="editor.dirty.value" />
  </section>
</template>
