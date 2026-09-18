<template>
  <IonItem :detail="true" lines="none" @click="onClicked">
    <IonLabel>
      <h2>{{ courseName }}</h2>
      <p class="ion-text-wrap">
        {{ groupName ?? $t('enrollment-no-group-yet') }}

        <IonText color="primary">{{ $t(`enrollment-status-${status}`) }}</IonText>
      </p>
    </IonLabel>
  </IonItem>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonText } from '@ionic/vue'
import type { EnrollmentsListItemEmits, EnrollmentsListItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<EnrollmentsListItemProps>(), { groupName: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsListItemEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onClicked() {
  emit('click')
}
</script>
