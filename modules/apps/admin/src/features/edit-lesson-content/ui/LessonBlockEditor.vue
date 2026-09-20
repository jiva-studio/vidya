<script setup lang="ts">
import type {
  AudioBlock,
  ImageBlock,
  LessonBlock,
  QuizBlock,
  TextBlock,
  VideoBlock,
} from '@vidya/domain'
import { computed } from 'vue'

import { isKnownBlockType } from '../model'
import AudioBlockEditor from './AudioBlockEditor.vue'
import ImageBlockEditor from './ImageBlockEditor.vue'
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

// One narrowed reference per kind, because a template cannot narrow a union and
// a dispatcher that casts is a dispatcher that renders the wrong editor quietly.
const text = computed(() => (props.block.type === 'text' ? (props.block as TextBlock) : undefined))
const video = computed(() =>
  props.block.type === 'video' ? (props.block as VideoBlock) : undefined,
)
const audio = computed(() =>
  props.block.type === 'audio' ? (props.block as AudioBlock) : undefined,
)
const image = computed(() =>
  props.block.type === 'image' ? (props.block as ImageBlock) : undefined,
)
const quiz = computed(() => (props.block.type === 'quiz' ? (props.block as QuizBlock) : undefined))

// Nothing this build cannot author may be edited, moved or deleted: the document
// is saved whole, and the block it does not understand is somebody's homework.
const unknown = computed(() => !isKnownBlockType(props.block.type))

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(block: LessonBlock) {
  emit('update', block)
}

function onSlash() {
  emit('slash')
}

function onEscape() {
  emit('escape')
}

function onSplit(head: string, tail: string) {
  emit('split', head, tail)
}
</script>

<template>
  <TextBlockEditor
    v-if="text"
    :block="text"
    :frozen="props.frozen"
    @update="onUpdate"
    @slash="onSlash"
    @escape="onEscape"
    @split="onSplit"
  />
  <ImageBlockEditor v-if="image" :block="image" :frozen="props.frozen" @update="onUpdate" />
  <VideoBlockEditor v-if="video" :block="video" :frozen="props.frozen" @update="onUpdate" />
  <AudioBlockEditor v-if="audio" :block="audio" :frozen="props.frozen" @update="onUpdate" />
  <QuizBlockEditor v-if="quiz" :block="quiz" :frozen="props.frozen" @update="onUpdate" />
  <UnknownBlockNotice v-if="unknown" :type="props.block.type" />
</template>
