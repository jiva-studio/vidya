<template>
  <IonToolbar>
    <IonTitle>{{ title }}</IonTitle>
    <IonButtons slot="start">
      <IonBackButton />
    </IonButtons>
  </IonToolbar>
</template>

<script setup lang="ts">
import { IonBackButton, IonButtons, IonTitle, IonToolbar } from '@ionic/vue'
import type { PageToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

defineProps<PageToolbarProps>()
</script>
