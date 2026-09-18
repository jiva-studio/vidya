<template>
  <IonItem lines="full" color="light">
    <h3>{{ block.question }}</h3>
  </IonItem>

  <IonRadioGroup v-model="answer">
    <IonItem v-for="(option, idx) in block.answers" :key="idx" lines="none">
      <IonRadio :value="idx">
        <IonLabel class="ion-text-wrap">{{ option }}</IonLabel>
      </IonRadio>
    </IonItem>
  </IonRadioGroup>
</template>

<script lang="ts" setup>
import { IonItem, IonLabel, IonRadio, IonRadioGroup } from '@ionic/vue'
import { ref, watch } from 'vue'
import type { QuizSectionBlockEmits, QuizSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// `block.rightAnswer` is deliberately not read: marking is the server's.
const props = withDefaults(defineProps<QuizSectionBlockProps>(), { state: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<QuizSectionBlockEmits>()

/* --------------------------------- State ---------------------------------- */

const NOT_ANSWERED = -1
const answer = ref(props.state?.answer ?? NOT_ANSWERED)

/* --------------------------------- Hooks ---------------------------------- */

watch(answer, (value) => emit('change', { type: 'quiz', answer: value }))
watch(
  () => props.state,
  (state) => (answer.value = state?.answer ?? NOT_ANSWERED),
)
</script>
