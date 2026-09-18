<template>
  <IonCard v-bind="$attrs">
    <IonCardHeader>
      <IonCardTitle>{{ name }}</IonCardTitle>
    </IonCardHeader>

    <IonCardContent v-if="description">
      {{ description }}
    </IonCardContent>
  </IonCard>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/vue'
import type { CourseCardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<CourseCardProps>(), { description: undefined })
</script>
