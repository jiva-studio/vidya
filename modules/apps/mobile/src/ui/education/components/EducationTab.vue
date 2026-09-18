<template>
  <IonTabButton :tab="tab" :href="href">
    <IonIcon aria-hidden="true" :icon="icon" />
    <IonLabel>{{ label }}</IonLabel>
  </IonTabButton>
</template>

<script setup lang="ts">
import { IonIcon, IonLabel, IonTabButton } from '@ionic/vue'

/* --------------------------------- Props ---------------------------------- */

defineProps<{ tab: string; href: string; icon: string; label: string }>()
</script>
