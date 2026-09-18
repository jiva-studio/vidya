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

/* --------------------------------- Props ---------------------------------- */

defineProps<{ title: string }>()
</script>
