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
import { Weekdays } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { closeOutline } from 'ionicons/icons'
import { computed } from 'vue'

import { formatMinuteOfDay, orderDays } from '../../model/timeRanges'
import type { TimeRangeItemEmits, TimeRangeItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<TimeRangeItemProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TimeRangeItemEmits>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const hours = computed(
  () =>
    `${formatMinuteOfDay(props.range.startMinute)} – ${formatMinuteOfDay(props.range.endMinute)}`,
)

const days = computed(() =>
  props.range.days.length === Weekdays.length
    ? fluent.$t('time-range-every-day')
    : orderDays(props.range.days)
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
