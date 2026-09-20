<template>
  <div>
    <IonChip
      v-for="preset in presets"
      :key="preset.key"
      :outline="true"
      @click="() => onPresetClicked(preset)"
    >
      {{ $t(`time-preset-${preset.key}`) }}
    </IonChip>

    <IonChip :outline="true" data-testid="time-range-custom" @click="onCustomClicked">
      {{ $t('time-range-custom') }}
    </IonChip>

    <TimeRangeItem
      v-for="(range, index) in modelValue"
      :key="index"
      :range="range"
      @click="() => onRangeClicked(index)"
      @remove="() => onRemoveClicked(index)"
    />

    <TimePicker
      v-if="edited !== null"
      :start-minute="edited.range?.startMinute"
      :end-minute="edited.range?.endMinute"
      @confirm="onPickerConfirmed"
      @cancel="onPickerCancelled"
    />
  </div>
</template>

<script setup lang="ts">
import { IonChip } from '@ionic/vue'
import type { TimeRange } from '@vidya/domain'
import { MAX_TIME_RANGES } from '@vidya/domain'
import { ref } from 'vue'

import { TimePicker } from '@/design'

import { everyDay, TIME_RANGE_PRESETS, type TimeRangePreset } from '../../model/timeRanges'
import TimeRangeItem from './TimeRangeItem.vue'
import type { TimeRangeSelectorEmits, TimeRangeSelectorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<TimeRangeSelectorProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TimeRangeSelectorEmits>()

/* --------------------------------- State ---------------------------------- */

const presets = TIME_RANGE_PRESETS

/** The interval the picker is open on; `range` is absent for a new one. */
const edited = ref<{ index: number | null; range?: TimeRange } | null>(null)

/* -------------------------------- Handlers -------------------------------- */

function onPresetClicked(preset: TimeRangePreset) {
  add(preset.range)
}

function onCustomClicked() {
  edited.value = { index: null }
}

function onRangeClicked(index: number) {
  const range = props.modelValue[index]
  if (range === undefined) return

  edited.value = { index, range }
}

function onRemoveClicked(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, at) => at !== index),
  )
}

function onPickerConfirmed(chosen: { startMinute: number; endMinute: number }) {
  const open = edited.value
  edited.value = null
  if (open === null) return

  // The days of an interval being corrected are not in the picker, so they
  // come back from the interval itself rather than from the default.
  if (open.index === null) add({ days: everyDay(), ...chosen })
  else replace(open.index, { days: open.range?.days ?? everyDay(), ...chosen })
}

function onPickerCancelled() {
  edited.value = null
}

/* -------------------------------- Helpers --------------------------------- */

const holds = (range: TimeRange): boolean =>
  props.modelValue.some(
    (held) =>
      held.startMinute === range.startMinute &&
      held.endMinute === range.endMinute &&
      held.days.join() === range.days.join(),
  )

function add(range: TimeRange) {
  if (holds(range) || props.modelValue.length >= MAX_TIME_RANGES) return

  emit('update:modelValue', [...props.modelValue, range])
}

function replace(index: number, range: TimeRange) {
  emit(
    'update:modelValue',
    props.modelValue.map((held, at) => (at === index ? range : held)),
  )
}
</script>
