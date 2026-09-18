<template>
  <IonItem
    :detail="true"
    lines="none"
    @click="onClicked"
  >
    <IonLabel>
      <h2>{{ courseName }}</h2>
      <p class="ion-text-wrap">
        {{ groupName ?? $t('no-group-yet') }}

        <IonText color="primary">{{ $t(status) }}</IonText>
      </p>
    </IonLabel>
  </IonItem>
</template>

<script setup lang="ts">
import type { EnrollmentStatus } from '@vidya/domain'
import { IonItem, IonLabel, IonText } from '@ionic/vue'

/* --------------------------------- Props ---------------------------------- */

withDefaults(
  defineProps<{
    id: string
    courseName: string
    groupName?: string
    status: EnrollmentStatus
  }>(),
  { groupName: undefined },
)

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ click: [] }>()

/* -------------------------------- Handlers -------------------------------- */

function onClicked() {
  emit('click')
}
</script>

<fluent locale="en">
pending = Pending
accepted = Accepted
declined = Declined
no-group-yet = Waiting for a group
</fluent>

<fluent locale="ru">
pending = На рассмотрении
accepted = Принято
declined = Отклонено
no-group-yet = Ожидает группу
</fluent>
