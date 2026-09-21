<template>
  <IonItemSliding>
    <IonItem :detail="true" lines="none" @click="onClicked">
      <IonLabel>
        <h2>{{ courseName }}</h2>
        <p class="ion-text-wrap">{{ groupName ?? $t('enrollment-no-group-yet') }}</p>
        <p class="state">{{ $t(`enrollment-status-${status}`) }}</p>
        <p v-if="requestedOn">{{ $t('enrollment-requested-on', { at: requestedOn }) }}</p>
      </IonLabel>
    </IonItem>

    <IonItemOptions v-if="action" side="end">
      <IonItemOption :color="action.color" @click="onActionClicked">
        {{ $t(action.label) }}
      </IonItemOption>
    </IonItemOptions>
  </IonItemSliding>
</template>

<script setup lang="ts">
import { IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel } from '@ionic/vue'
import { computed } from 'vue'

import { actionFor } from '../../model/enrollmentActions'
import type { EnrollmentsListItemEmits, EnrollmentsListItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EnrollmentsListItemProps>(), {
  groupName: undefined,
  requestedAt: undefined,
})

/* --------------------------------- State ---------------------------------- */

const action = computed(() => actionFor(props.status))

// Handed to the bundle as an instant, so the day is written the way the
// student's own language writes days.
const requestedOn = computed(() => (props.requestedAt ? new Date(props.requestedAt) : undefined))

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsListItemEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onClicked() {
  emit('click')
}

function onActionClicked() {
  if (action.value) emit('action', action.value)
}
</script>

<style scoped>
.state {
  color: var(--ion-color-primary);
}
</style>
