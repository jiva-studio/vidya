<script setup lang="ts">
import type { LessonSection, SectionId } from '@vidya/domain'
import { LessonPreview } from '@vidya/ui'

import { useOutboxView } from '@/shared/sync'

import type { LessonBodyEmits, LessonBodyProps } from '../types'
import SectionHomework from './SectionHomework.vue'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonBodyProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonBodyEmits>()

/* --------------------------------- State ---------------------------------- */

const outbox = useOutboxView()

/* -------------------------------- Helpers --------------------------------- */

function answerOn(section: LessonSection) {
  return props.answers[section.id as SectionId] ?? null
}

function stateOn(section: LessonSection) {
  const answer = answerOn(section)
  return answer === null ? undefined : outbox.state('homework', answer.id)
}

function reasonOn(section: LessonSection) {
  const answer = answerOn(section)
  return answer === null ? undefined : outbox.reason('homework', answer.id)
}
</script>

<template>
  <LessonPreview
    :content="props.content"
    :labels="props.labels"
    :progress="props.progress"
    @change="(blockId, state) => emit('change', blockId, state)"
  >
    <template v-if="props.answerable" #section="{ section }">
      <SectionHomework
        :section="section"
        :answer="answerOn(section)"
        :writable="props.writable"
        :submission="stateOn(section)"
        :reason="reasonOn(section)"
        @save="(text) => emit('save', section, text)"
        @hand="emit('hand', section)"
      />
    </template>
  </LessonPreview>
</template>
