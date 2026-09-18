<script setup lang="ts">
import { TabsContent } from 'reka-ui'

import { cn } from '../../lib/utils'
import { panelClasses } from './styles'
import type { TabsPanelProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TabsPanelProps>(), { class: undefined })
</script>

<template>
  <TabsContent :value="props.value" :class="cn(panelClasses, props.class)">
    <slot />
  </TabsContent>
</template>
