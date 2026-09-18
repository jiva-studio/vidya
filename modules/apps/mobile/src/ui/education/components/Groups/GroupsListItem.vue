<template>
  <IonItem lines="none">
    <IonRadio :value="id">
      <IonLabel>
        <h2>{{ name }}</h2>
      </IonLabel>
    </IonRadio>
  </IonItem>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonRadio } from '@ionic/vue'

/* --------------------------------- Props ---------------------------------- */

defineProps<{ id: string; name: string }>()
</script>
