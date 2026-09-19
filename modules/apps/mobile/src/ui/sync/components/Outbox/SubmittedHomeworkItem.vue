<template>
  <WithBorders>
    <div class="item">
      <IonLabel v-if="lessonTitle">{{ lessonTitle }}</IonLabel>
      <MissingLessonVersionNote v-else />

      <SyncStateBadge :state="state" />

      <IonText class="answer">{{ answerText }}</IonText>

      <SyncRejectionNotice v-if="reason" :reason="reason" />
    </div>
  </WithBorders>
</template>

<script lang="ts" setup>
import { IonLabel, IonText } from '@ionic/vue'

import { WithBorders } from '@/design'

import MissingLessonVersionNote from './MissingLessonVersionNote.vue'
import SyncRejectionNotice from './SyncRejectionNotice.vue'
import SyncStateBadge from './SyncStateBadge.vue'
import type { SubmittedHomeworkItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The answer is rendered whatever else is missing: a missing parent costs the
// title, never the student's work.
defineProps<SubmittedHomeworkItemProps>()
</script>

<style scoped>
.item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px 0;
}

.answer {
  white-space: pre-wrap;
}
</style>
