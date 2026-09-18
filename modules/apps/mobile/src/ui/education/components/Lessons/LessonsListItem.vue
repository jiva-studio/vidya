<template>
  <IonItem :detail="true" lines="full" @click="onClicked">
    <IonLabel>
      <h2>
        {{ item.title }}
      </h2>
      <p class="ion-text-wrap">
        {{ item.lessonNumber }}
      </p>
    </IonLabel>
  </IonItem>
</template>

<script setup lang="ts">
import { IonItem, IonLabel } from '@ionic/vue'
import type { LessonSummary } from '@vidya/protocol'

/* -------------------------------------------------------------------------- */
/*                                  Interface                                 */
/* -------------------------------------------------------------------------- */

defineProps<{
  item: LessonSummary
}>()

const emit = defineEmits<{
  click: []
}>()

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

function onClicked() {
  emit('click')
}
</script>
