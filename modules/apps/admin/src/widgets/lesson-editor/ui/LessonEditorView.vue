<script setup lang="ts">
import type { LessonContent } from '@vidya/domain'
import { ErrorState, Skeleton } from '@vidya/ui'
import { computed, onMounted, ref, watch } from 'vue'

import { contentProblems, useLessonContentEditor } from '@/features/edit-lesson-content'
import { PublishDialog } from '@/features/publish-lesson'
import { useCan } from '@/shared/access'

import { useDraftSaving, useLessonPublishing, useLessonVersionDocument } from '../model'
import ContentProblemsNotice from './ContentProblemsNotice.vue'
import EditorToolbar from './EditorToolbar.vue'
import LessonDocument from './LessonDocument.vue'
import LessonOutline from './LessonOutline.vue'
import LessonPreview from './LessonPreview.vue'
import { editorClasses, readingClasses } from './styles'
import type { EditorMode, LessonEditorViewEmits, LessonEditorViewProps } from './types'
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

const canPublish = useCan('lessons:publish')
const publishOpen = ref(false)
const mode = ref<EditorMode>('write')

const frozen = computed(() => versionDoc.version.value?.status === 'published')
const problems = computed(() => contentProblems(editor.content.value))
const blocked = computed(() => problems.value.length > 0)
const actionError = computed(() => draft.error.value ?? publishing.error.value)
const writing = computed(() => mode.value === 'write')
const sections = computed(() => editor.content.value.sections)

/* --------------------------------- Hooks ---------------------------------- */

watch(versionDoc.version, (version) => {
  if (version) editor.load(version.content)
})

// A version nobody can change opens as what it is: something to read.
watch(frozen, (value) => {
  mode.value = value ? 'read' : 'write'
})

onMounted(() => {
  void versionDoc.open()
})

/* -------------------------------- Handlers -------------------------------- */

function onMode(next: EditorMode) {
  mode.value = next
}

function onContent(content: LessonContent) {
  editor.set(content)
}

function onBack() {
  emit('back')
}

function onRetry() {
  void versionDoc.open()
}

function onPublish() {
  publishOpen.value = true
}

function onPublishOpen(open: boolean) {
  publishOpen.value = open
}

async function onSave() {
  await store()
}

// Publishing freezes what the server holds, so anything still on screen has to
// reach it first; a failed save stops the publish rather than freezing an old text.
async function onPublishConfirm() {
  const version = versionDoc.version.value
  if (!version) return
  if (editor.dirty.value && !(await store())) return
  if (!(await publishing.publish(version.id))) return

  publishOpen.value = false
  await versionDoc.open(version.id)
}

async function onRevision() {
  const opened = await publishing.openRevision()
  if (opened) await versionDoc.open(opened)
}

/* -------------------------------- Helpers --------------------------------- */

async function store(): Promise<boolean> {
  const version = versionDoc.version.value
  if (!version || frozen.value || blocked.value) return false

  const saved = await draft.save(version.id, editor.content.value)
  if (saved) editor.markSaved()
  return saved
}
</script>

<template>
  <section :class="editorClasses">
    <EditorToolbar
      :title="props.title"
      :version="versionDoc.version.value?.version"
      :mode="mode"
      :frozen="frozen"
      :dirty="editor.dirty.value"
      :saving="draft.saving.value"
      :busy="publishing.busy.value"
      :can-publish="canPublish"
      :blocked="blocked"
      :error="actionError && $t(actionError)"
      @update:mode="onMode"
      @back="onBack"
      @save="onSave"
      @publish="onPublish"
      @revision="onRevision"
    />
    <ContentProblemsNotice v-if="blocked" :problems="problems" />
    <Skeleton v-if="versionDoc.loading.value" shape="block" />
    <ErrorState
      v-else-if="versionDoc.error.value"
      :title="$t('state-error-title')"
      :description="$t(versionDoc.error.value)"
      :retry-label="$t('editor-retry')"
      @retry="onRetry"
    />
    <template v-else-if="writing">
      <LessonOutline v-if="sections.length > 0" :sections="sections" />
      <LessonDocument
        :content="editor.content.value"
        :frozen="frozen"
        @update:content="onContent"
      />
    </template>
    <div v-else :class="readingClasses">
      <LessonPreview :content="editor.content.value" />
    </div>
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
