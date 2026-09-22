<script setup lang="ts">
import { education } from '@vidya/client'
import { Checkbox } from '@vidya/ui'

import type { EnrollTimesEmits, EnrollTimesProps } from '../types'
import { choiceListClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollTimesProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollTimesEmits>()

/* --------------------------------- State ---------------------------------- */

const presets = education.TIME_RANGE_PRESETS

/* -------------------------------- Handlers -------------------------------- */

function onToggled(key: string, ticked: boolean) {
  emit('update:chosen', ticked ? [...props.chosen, key] : props.chosen.filter((of) => of !== key))
}
</script>

<template>
  <div :class="choiceListClasses">
    <Checkbox
      v-for="preset in presets"
      :key="preset.key"
      :model-value="props.chosen.includes(preset.key)"
      :label="$t(`time-preset-${preset.key}`)"
      @update:model-value="onToggled(preset.key, $event)"
    />
  </div>
</template>
