<template>
  <div class="ion-padding">
    <IonTextarea
      v-model="text"
      :auto-grow="true"
      :disabled="isFrozen"
      :label="$t('homework-your-answer')"
      label-placement="stacked"
    />

    <IonNote color="primary">{{ $t(`homework-status-${status}`) }}</IonNote>

    <AsyncButton
      :busy="busy"
      :disabled="isFrozen || text.trim().length === 0"
      expand="block"
      @click="onSubmitClicked"
    >
      {{ $t('homework-send-to-review') }}
    </AsyncButton>
  </div>
</template>

<script lang="ts" setup>
import { IonNote, IonTextarea } from '@ionic/vue'
import { computed, ref, watch } from 'vue'

import { AsyncButton } from '@/design'

import type { HomeworkAnswerEmits, HomeworkAnswerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<HomeworkAnswerProps>(), { answer: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkAnswerEmits>()

/* --------------------------------- State ---------------------------------- */

const text = ref(props.answer ?? '')
const busy = ref(false)

// Submitting freezes the answer: it cannot be edited again until a reviewer
// sends it back. `returned` is the one state that reopens it.
const isFrozen = computed(() => props.status !== 'open' && props.status !== 'returned')

/* --------------------------------- Hooks ---------------------------------- */

// The answer arrives after the section does, and a section switch brings a
// different one, so the box follows it rather than being seeded once.
watch(
  () => props.answer,
  (answer) => (text.value = answer ?? ''),
)

/* -------------------------------- Handlers -------------------------------- */

async function onSubmitClicked() {
  busy.value = true
  try {
    emit('submit', text.value)
  } finally {
    busy.value = false
  }
}
</script>
