<template>
  <IonButton expand="block" fill="clear" size="small" color="danger" @click="onClicked">
    {{ $t(action.label) }}
  </IonButton>

  <IonAlert
    :header="$t(action.label)"
    :message="question"
    :is-open="asking"
    :buttons="buttons"
    @did-dismiss="onAlertDismissed"
  />
</template>

<script setup lang="ts">
import { IonAlert, IonButton } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { EnrollmentDangerActionEmits, EnrollmentDangerActionProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The way out of a place the student holds, offered where they are reading
// about it rather than only on the row it was opened from.
const props = defineProps<EnrollmentDangerActionProps>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const asking = ref(false)

const question = computed(() =>
  props.action.confirmation ? fluent.$t(props.action.confirmation) : '',
)

const buttons = computed(() => [
  { text: fluent.$t('no'), role: 'cancel' },
  { text: fluent.$t('yes'), role: 'confirm' },
])

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentDangerActionEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onClicked() {
  if (props.action.confirmation) asking.value = true
  else emit('confirm')
}

function onAlertDismissed(event: CustomEvent) {
  if (event.detail.role === 'confirm') emit('confirm')
  asking.value = false
}
</script>
