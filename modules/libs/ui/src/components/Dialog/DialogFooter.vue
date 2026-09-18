<script setup lang="ts">
import { cn } from '../../lib/utils'
import { footerClasses } from './styles'
import type { DialogFooterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DialogFooterProps>(), { class: undefined })
</script>

<template>
  <div :class="cn(footerClasses, props.class)">
    <slot />
  </div>
</template>
