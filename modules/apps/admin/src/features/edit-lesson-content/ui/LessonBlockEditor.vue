<script setup lang="ts">
import type { AudioBlock, LessonBlock, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { MoveDirection } from '../types'
import { isKnownBlockType } from '../model'
import AudioBlockEditor from './AudioBlockEditor.vue'
import BlockShell from './BlockShell.vue'
import QuizBlockEditor from './QuizBlockEditor.vue'
import TextBlockEditor from './TextBlockEditor.vue'
import type { LessonBlockEditorEmits, LessonBlockEditorProps } from './types'
import UnknownBlockNotice from './UnknownBlockNotice.vue'
import VideoBlockEditor from './VideoBlockEditor.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// One narrowed reference per kind, because a template cannot narrow a union and
// a dispatcher that casts is a dispatcher that renders the wrong editor quietly.
const text = computed(() => (props.block.type === 'text' ? (props.block as TextBlock) : undefined))
const video = computed(() =>
  props.block.type === 'video' ? (props.block as VideoBlock) : undefined,
)
const audio = computed(() =>
  props.block.type === 'audio' ? (props.block as AudioBlock) : undefined,
)
const quiz = computed(() => (props.block.type === 'quiz' ? (props.block as QuizBlock) : undefined))

// Nothing this build cannot author may be edited, moved or deleted: the document
// is saved whole, and the block it does not understand is somebody's homework.
const unknown = computed(() => !isKnownBlockType(props.block.type))

const label = computed(() =>
  unknown.value ? $t('editor-block-unknown') : $t(`editor-block-${props.block.type}`),
)

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(block: LessonBlock) {
  emit('update', block)
}

function onMove(delta: MoveDirection) {
  emit('move', props.block.id, delta)
}

function onRemove() {
  emit('remove', props.block.id)
}
</script>

<template>
  <BlockShell
    :label="label"
    :index="props.index"
    :count="props.count"
    :frozen="props.frozen || unknown"
    @move="onMove"
    @remove="onRemove"
  >
    <TextBlockEditor v-if="text" :block="text" :frozen="props.frozen" @update="onUpdate" />
    <VideoBlockEditor v-if="video" :block="video" :frozen="props.frozen" @update="onUpdate" />
    <AudioBlockEditor v-if="audio" :block="audio" :frozen="props.frozen" @update="onUpdate" />
    <QuizBlockEditor v-if="quiz" :block="quiz" :frozen="props.frozen" @update="onUpdate" />
    <UnknownBlockNotice v-if="unknown" :type="props.block.type" />
  </BlockShell>
</template>
