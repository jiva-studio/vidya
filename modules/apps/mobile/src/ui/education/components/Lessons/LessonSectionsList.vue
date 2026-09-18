<template>
  <IonSegment :value="selected">
    <IonSegmentButton
      v-for="(section, idx) in items"
      :key="idx"
      :value="idx"
      @click="selected = idx"
    >
      <ion-label>{{ section.title }}</ion-label>
    </IonSegmentButton>
  </IonSegment>
</template>

<script setup lang="ts">
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue'
import type { LessonSectionsListProps } from './types'

defineProps<LessonSectionsListProps>()

const selected = defineModel<number>({ default: 0 })
</script>
