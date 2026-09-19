<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogClose, DialogDescription, DialogTitle } from 'reka-ui'

import { cn } from '../../lib/utils'
import {
  closeClasses,
  descriptionClasses,
  headerClasses,
  headingsClasses,
  iconClasses,
  titleClasses,
} from './styles'
import type { DialogHeaderProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DialogHeaderProps>(), {
  description: undefined,
  closeLabel: 'Close',
  class: undefined,
})
</script>

<template>
  <div :class="cn(headerClasses, props.class)">
    <div :class="headingsClasses">
      <DialogTitle :class="titleClasses">{{ props.title }}</DialogTitle>
      <DialogDescription v-if="props.description" :class="descriptionClasses">
        {{ props.description }}
      </DialogDescription>
    </div>
    <DialogClose :class="closeClasses" :aria-label="props.closeLabel">
      <X :class="iconClasses" />
    </DialogClose>
  </div>
</template>
