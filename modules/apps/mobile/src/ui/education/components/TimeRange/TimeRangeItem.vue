<template>
  <IonItem :button="true" lines="none" @click="onClicked">
    <IonLabel>
      <h3>{{ hours }}</h3>
      <p class="ion-text-wrap">{{ days }}</p>
    </IonLabel>

    <IonButton
      slot="end"
      fill="clear"
      :aria-label="$t('time-range-remove')"
      @click.stop="onRemoveClicked"
    >
      <IonIcon slot="icon-only" :icon="closeOutline" />
    </IonButton>
  </IonItem>
</template>

<script setup lang="ts">
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/vue'
import { education } from '@vidya/client'
import { Weekdays } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { closeOutline } from 'ionicons/icons'
import { computed } from 'vue'

import type { TimeRangeItemEmits, TimeRangeItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<TimeRangeItemProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TimeRangeItemEmits>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const hours = computed(
  () =>
    `${education.formatMinuteOfDay(props.range.startMinute)} – ${education.formatMinuteOfDay(props.range.endMinute)}`,
)

const days = computed(() =>
  props.range.days.length === Weekdays.length
    ? fluent.$t('time-range-every-day')
    : education
        .orderDays(props.range.days)
        .map((day) => fluent.$t(`weekday-short-${day}`))
        .join(' '),
)

/* -------------------------------- Handlers -------------------------------- */

function onClicked() {
  emit('click')
}

function onRemoveClicked() {
  emit('remove')
}
</script>
