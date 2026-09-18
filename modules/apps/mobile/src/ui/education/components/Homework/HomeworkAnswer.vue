<template>
  <div class="ion-padding">
    <IonTextarea
      v-model="text"
      :auto-grow="true"
      :disabled="isFrozen"
      :label="$t('your-answer')"
      label-placement="stacked"
    />

    <IonNote color="primary">{{ $t(status) }}</IonNote>

    <AsyncButton
      :busy="busy"
      :disabled="isFrozen || text.trim().length === 0"
      expand="block"
      @click="onSubmitClicked"
    >
      {{ $t('send-to-review') }}
    </AsyncButton>
  </div>
</template>

<script lang="ts" setup>
import type { HomeworkStatus } from '@vidya/domain'
import { IonNote, IonTextarea } from '@ionic/vue'
import { computed, ref } from 'vue'

import { AsyncButton } from '@/design'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ status: HomeworkStatus }>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ submit: [text: string] }>()

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

<fluent locale="en">
your-answer = Your answer
send-to-review = Send to review
open = Not submitted
pending = Submitted, waiting for review
in_review = Being reviewed
returned = Returned for revision
accepted = Accepted
</fluent>

<fluent locale="ru">
your-answer = Ваш ответ
send-to-review = Отправить на проверку
open = Не отправлено
pending = Отправлено, ждёт проверки
in_review = На проверке
returned = Возвращено на доработку
accepted = Принято
</fluent>
