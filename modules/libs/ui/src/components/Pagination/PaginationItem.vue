<script setup lang="ts">
import { PaginationEllipsis, PaginationListItem } from 'reka-ui'

import { cn } from '../../lib/utils'
import { ellipsisClasses, pageClasses } from './styles'
import type { PaginationItemProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PaginationItemProps>(), { class: undefined })
</script>

<template>
  <PaginationListItem
    v-if="props.item.type === 'page'"
    :value="props.item.value ?? 1"
    :class="cn(pageClasses, props.class)"
  >
    {{ props.item.value }}
  </PaginationListItem>
  <PaginationEllipsis v-else :class="cn(ellipsisClasses, props.class)">&hellip;</PaginationEllipsis>
</template>
