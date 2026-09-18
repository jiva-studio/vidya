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
import { computed, ref } from 'vue'

import { AsyncButton } from '@/design'
import type { HomeworkAnswerEmits, HomeworkAnswerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkAnswerProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkAnswerEmits>()

/* --------------------------------- State ---------------------------------- */

const text = ref('')
const busy = ref(false)

// Submitting freezes the answer: it cannot be edited again until a reviewer
// sends it back. `returned` is the one state that reopens it.
const isFrozen = computed(() => props.status !== 'open' && props.status !== 'returned')

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
