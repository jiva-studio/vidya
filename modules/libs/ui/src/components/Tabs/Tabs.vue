<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { cn } from '../../lib/utils'
import { listVariants, rootClasses, triggerVariants } from './styles'
import type { TabsEmits, TabsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TabsProps>(), {
  variant: 'line',
  label: 'Sections',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TabsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: unknown) {
  emit('update:modelValue', String(value))
}
</script>

<template>
  <TabsRoot
    :model-value="props.modelValue"
    :class="cn(rootClasses, props.class)"
    @update:model-value="onUpdate"
  >
    <TabsList :class="listVariants({ variant: props.variant })" :aria-label="props.label">
      <TabsTrigger
        v-for="item in props.items"
        :key="item.value"
        :value="item.value"
        :disabled="item.disabled"
        :class="triggerVariants({ variant: props.variant })"
      >
        {{ item.label }}
      </TabsTrigger>
    </TabsList>
    <slot />
  </TabsRoot>
</template>
