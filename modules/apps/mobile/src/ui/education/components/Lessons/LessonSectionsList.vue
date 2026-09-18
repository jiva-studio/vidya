<template>
  <IonSegment
    :value="selected"
  >
    <IonSegmentButton
      v-for="section, idx in items"
      :key="idx"
      :value="idx"
      @click="selected = idx"
    >
      <ion-label>{{ section.title }}</ion-label>
    </IonSegmentButton>
  </IonSegment>
</template>


<script setup lang="ts">
import type { LessonSectionViewModel } from './LessonSectionViewModel'
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue'

defineProps<{
  items: readonly LessonSectionViewModel[]
}>()

const selected = defineModel<number>({ default: 0 })
</script>