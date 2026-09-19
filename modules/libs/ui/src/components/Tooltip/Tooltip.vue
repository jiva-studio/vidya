<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'

import { cn } from '../../lib/utils'
import { contentClasses } from './styles'
import type { TooltipProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TooltipProps>(), {
  side: 'top',
  delay: 200,
  class: undefined,
})
</script>

<template>
  <TooltipProvider :delay-duration="props.delay" :skip-delay-duration="props.delay === 0 ? 0 : 300">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :class="cn(contentClasses, props.class)"
          :side="props.side"
          :side-offset="4"
        >
          {{ props.text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
