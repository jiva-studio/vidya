<script setup lang="ts">
import { isHomeworkEditable } from '@vidya/client'
import { Badge, Button, Textarea } from '@vidya/ui'
import { computed, ref, watch } from 'vue'

import { describeAnswer } from '@/shared/lib'
import {
  answerClasses,
  commentClasses,
  mutedClasses,
  answerRowClasses,
  SubmissionNotice,
} from '@/shared/ui'

import type { SectionHomeworkEmits, SectionHomeworkProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SectionHomeworkProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionHomeworkEmits>()

/* --------------------------------- State ---------------------------------- */

const asked = computed(() => props.section.assessment !== 'none')
const marked = computed(() => props.section.assessment === 'auto')

const badge = computed(() => (props.answer === null ? null : describeAnswer(props.answer.status)))

// The freeze rule is the client library's, and it is asked rather than
// restated: a form drawn from a second opinion about it would take work the
// device is bound to refuse, and the student would be told off for using it.
const open = computed(() => props.answer === null || isHomeworkEditable(props.answer.status))
const editable = computed(() => props.writable && open.value)

const draft = ref(props.answer?.text ?? '')
let lastAnswerId = props.answer?.id

// A pull or initial query can populate the answer after mount. The draft
// follows when switching answers or when the record is first loaded.
watch(
  () => props.answer?.id,
  (newId) => {
    if (newId !== lastAnswerId) {
      lastAnswerId = newId
      draft.value = props.answer?.text ?? ''
    }
  },
)

const handable = computed(() => editable.value && draft.value.trim() !== '')

/* -------------------------------- Handlers -------------------------------- */

function onSave() {
  emit('save', draft.value)
}

function onHand() {
  emit('save', draft.value)
  emit('hand')
}
</script>

<template>
  <section v-if="asked" :class="answerClasses">
    <div :class="answerRowClasses">
      <strong>{{ $t('answer-title') }}</strong>
      <Badge v-if="badge" :tone="badge.tone">{{ $t(badge.key) }}</Badge>
    </div>

    <p v-if="props.answer && props.answer.grade !== null">
      {{ $t('answer-grade', { grade: props.answer.grade }) }}
    </p>

    <p v-if="props.answer?.comment" :class="commentClasses">{{ props.answer.comment }}</p>

    <template v-if="marked">
      <p :class="mutedClasses">{{ $t('answer-marked-here') }}</p>
    </template>

    <template v-else-if="editable">
      <Textarea v-model="draft" :placeholder="$t('answer-placeholder')" />
      <div :class="answerRowClasses">
        <Button variant="secondary" @click="onSave">{{ $t('answer-save') }}</Button>
        <Button :disabled="!handable" @click="onHand">{{ $t('answer-hand-in') }}</Button>
      </div>
    </template>

    <template v-else>
      <p v-if="props.answer">{{ props.answer.text }}</p>
      <p v-else :class="mutedClasses">{{ $t('answer-none') }}</p>
      <p v-if="props.answer && !open" :class="mutedClasses">{{ $t('answer-frozen') }}</p>
      <p v-else-if="!props.writable" :class="mutedClasses">{{ $t('answer-read-only') }}</p>
    </template>

    <SubmissionNotice
      v-if="props.answer && props.submission"
      :state="props.submission"
      :reason="props.reason"
    />
  </section>
</template>
