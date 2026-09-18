<template>
  <div v-for="block in blocks" :key="block.id">
    <TextSectionBlock v-if="block.type === 'text'" :block="block" />
    <VideoSectionBlock
      v-else-if="block.type === 'video'"
      :block="block"
      :state="videoState(block.id)"
      @change="(state) => onBlockStateChanged(block.id, state)"
    />
    <AudioSectionBlock
      v-else-if="block.type === 'audio'"
      :block="block"
      :state="audioState(block.id)"
      @change="(state) => onBlockStateChanged(block.id, state)"
    />
    <QuizSectionBlock
      v-else
      :block="block"
      :state="quizState(block.id)"
      @change="(state) => onBlockStateChanged(block.id, state)"
    />
  </div>
</template>

<script setup lang="ts">
import type { BlockId } from '@vidya/domain'
import type {
  AudioBlockState,
  LessonBlockState,
  QuizBlockState,
  VideoBlockState,
} from '@vidya/protocol'

import {
  AudioSectionBlock,
  QuizSectionBlock,
  TextSectionBlock,
  VideoSectionBlock,
} from './SectionBlocks'
import type { LessonSectionViewEmits, LessonSectionViewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonSectionViewProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonSectionViewEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onBlockStateChanged(blockId: BlockId, state: LessonBlockState) {
  emit('change', blockId, state)
}

/* -------------------------------- Helpers --------------------------------- */

// A narrowing read per kind: the child wants its own state type, and the record
// holds the union.
function videoState(blockId: BlockId): VideoBlockState | undefined {
  const state = props.states[blockId]
  return state?.type === 'video' ? state : undefined
}

function audioState(blockId: BlockId): AudioBlockState | undefined {
  const state = props.states[blockId]
  return state?.type === 'audio' ? state : undefined
}

function quizState(blockId: BlockId): QuizBlockState | undefined {
  const state = props.states[blockId]
  return state?.type === 'quiz' ? state : undefined
}
</script>
