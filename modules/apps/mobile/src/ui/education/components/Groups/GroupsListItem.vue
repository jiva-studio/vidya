<template>
  <IonItem lines="none">
    <IonRadio v-if="selectable" slot="start" :value="value" />

    <IonLabel>
      <h2>{{ name }}</h2>
      <p v-if="description" class="ion-text-wrap">{{ description }}</p>
    </IonLabel>
  </IonItem>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonRadio } from '@ionic/vue'

import type { GroupsListItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<GroupsListItemProps>(), { description: null, selectable: false })
</script>
