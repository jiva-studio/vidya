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
import type { LessonsListItemEmits, LessonsListItemProps } from './types'

/* -------------------------------------------------------------------------- */
/*                                  Interface                                 */
/* -------------------------------------------------------------------------- */

defineProps<LessonsListItemProps>()

const emit = defineEmits<LessonsListItemEmits>()

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                  */
/* -------------------------------------------------------------------------- */

function onClicked() {
  emit('click')
}
</script>
