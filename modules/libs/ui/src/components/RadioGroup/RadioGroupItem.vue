<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem as RekaRadioItem } from 'reka-ui'
import { useId } from 'vue'

import { cn } from '../../lib/utils'
import {
  descriptionClasses,
  dotClasses,
  dotWrapperClasses,
  itemWrapperClasses,
  labelClasses,
  textClasses,
} from './styles'
import type { RadioGroupItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<RadioGroupItemProps>(), { class: undefined })

/* --------------------------------- State ---------------------------------- */

const itemId = useId()
</script>

<template>
  <div :class="cn(itemWrapperClasses, props.class)">
    <RekaRadioItem
      :id="itemId"
      :value="props.option.value"
      :disabled="props.option.disabled"
      :class="dotWrapperClasses"
    >
      <RadioGroupIndicator :class="dotClasses" />
    </RekaRadioItem>
    <div :class="textClasses">
      <label :for="itemId" :class="labelClasses">{{ props.option.label }}</label>
      <span v-if="props.option.description" :class="descriptionClasses">
        {{ props.option.description }}
      </span>
    </div>
  </div>
</template>
