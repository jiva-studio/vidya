<template>
  <div class="time-picker">
    <IonPicker>
      <IonPickerColumn
        data-testid="time-picker-start"
        :value="startValue"
        @ion-change="onStartChanged"
      >
        <IonPickerColumnOption v-for="minute in startOptions" :key="minute" :value="minute">
          {{ labelOf(minute) }}
        </IonPickerColumnOption>
      </IonPickerColumn>

      <IonPickerColumn data-testid="time-picker-end" :value="endValue" @ion-change="onEndChanged">
        <IonPickerColumnOption v-for="minute in endOptions" :key="minute" :value="minute">
          {{ labelOf(minute) }}
        </IonPickerColumnOption>
      </IonPickerColumn>
    </IonPicker>

    <div class="actions">
      <IonButton fill="clear" data-testid="time-picker-cancel" @click="onCancelClicked">
        {{ $t('cancel') }}
      </IonButton>
      <IonButton fill="clear" data-testid="time-picker-confirm" @click="onConfirmClicked">
        {{ $t('done') }}
      </IonButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton, IonPicker, IonPickerColumn, IonPickerColumnOption } from '@ionic/vue'
import { computed, ref, watch } from 'vue'

import type { TimePickerEmits, TimePickerProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TimePickerProps>(), {
  startMinute: undefined,
  endMinute: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TimePickerEmits>()

/* --------------------------------- State ---------------------------------- */

const HOUR = 60
const END_OF_DAY = 24 * HOUR
const DEFAULT_START = 9 * HOUR
const DEFAULT_END = 12 * HOUR

const startValue = ref(props.startMinute ?? DEFAULT_START)
const endValue = ref(props.endMinute ?? DEFAULT_END)

const hoursBetween = (from: number, to: number): number[] => {
  const hours: number[] = []
  for (let minute = from; minute <= to; minute += HOUR) hours.push(minute)

  return hours
}

// The day ends at 1440, and it ends there only: an interval beginning at
// midnight begins the next day, which this picker does not speak about.
const startOptions = hoursBetween(0, END_OF_DAY - HOUR)

const endOptions = computed(() =>
  hoursBetween(Math.floor(startValue.value / HOUR) * HOUR + HOUR, END_OF_DAY),
)

watch(
  () => [props.startMinute, props.endMinute],
  ([start, end]) => {
    startValue.value = start ?? DEFAULT_START
    endValue.value = end ?? DEFAULT_END
  },
)

/* -------------------------------- Handlers -------------------------------- */

/** `@ionic/vue` re-exports neither the column's event nor its value type. */
type PickerColumnChange = CustomEvent<{ value: string | number | undefined }>

const chosenIn = (event: PickerColumnChange): number | undefined =>
  typeof event.detail.value === 'number' ? event.detail.value : undefined

function onStartChanged(event: PickerColumnChange) {
  const minute = chosenIn(event)
  if (minute === undefined) return

  startValue.value = minute
  if (endValue.value <= minute) endValue.value = minute + HOUR
}

function onEndChanged(event: PickerColumnChange) {
  const minute = chosenIn(event)
  if (minute === undefined) return

  endValue.value = minute
}

function onConfirmClicked() {
  emit('confirm', { startMinute: startValue.value, endMinute: endValue.value })
}

function onCancelClicked() {
  emit('cancel')
}

/* -------------------------------- Helpers --------------------------------- */

const labelOf = (minute: number): string =>
  `${String(Math.floor(minute / HOUR)).padStart(2, '0')}:${String(minute % HOUR).padStart(2, '0')}`
</script>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
