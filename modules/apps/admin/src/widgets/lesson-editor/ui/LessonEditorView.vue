<script setup lang="ts">
import type { BlockId, LessonContent } from '@vidya/domain'
import { FailureState, Skeleton } from '@vidya/ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { BlockFault } from '@/features/edit-lesson-content'
import {
  blockAnchorOf,
  findBlockFaults,
  contentProblems,
  provideFaultedBlocks,
  pruneForSave,
  useLessonContentEditor,
} from '@/features/edit-lesson-content'
import { PublishDialog } from '@/features/publish-lesson'
import { useCan } from '@/shared/access'

import {
  useAutosave,
  useDraftFork,
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
const fork = useDraftFork(publishing.openRevision, (id) => versionDoc.open(id, true))

const publishable = useCan('lessons:publish')
const publishOpen = ref(false)
const faults = ref<BlockFault[]>([])

const frozen = computed(() => versionDoc.version.value?.status === 'published')
const problems = computed(() => contentProblems(editor.content.value))
const blocked = computed(() => problems.value.length > 0)
const noticed = computed(() => blocked.value || faults.value.length > 0)
const faultedBlocks = computed(() => faults.value.map((fault) => fault.blockId))

provideFaultedBlocks(faultedBlocks)

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

// The edit stays on screen whatever the fork does: it exists nowhere else.
async function onContent(content: LessonContent) {
  editor.set(content)

  if (frozen.value && !(await fork.start())) return
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

async function onSaveRetry() {
  if (frozen.value) return onSave()
  await autosave.retry()
}

function onPublish() {
  faults.value = findBlockFaults(editor.content.value)
  const first = faults.value.at(0)

  if (first) reveal(first.blockId)
  else publishOpen.value = true
}

function onReveal(blockId: BlockId) {
  reveal(blockId)
}

function onPublishOpen(open: boolean) {
  publishOpen.value = open
}

// Saving a document still on the frozen version means forking first.
async function onSave() {
  if (frozen.value) {
    if (!(await fork.start())) return
    queue()
  }

  await autosave.flush()
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

function reveal(id: BlockId) {
  document
    .getElementById(blockAnchorOf(id))
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
      :error="publishing.error.value && $t(publishing.error.value)"
      @rename="onRename"
      @back="onBack"
      @save="onSave"
      @retry="onSaveRetry"
      @publish="onPublish"
    />
    <ContentProblemsNotice
      v-if="noticed"
      :problems="problems"
      :faults="faults"
      @reveal="onReveal"
    />
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
      :frozen="blocked"
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
