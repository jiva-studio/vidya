<script setup lang="ts">
import { Avatar } from '@vidya/ui'
import { computed } from 'vue'

import type { AccountMenuHeaderProps } from '../types'

import { headerClasses, headerEmailClasses, headerNameClasses, headerTextClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<AccountMenuHeaderProps>()

/* --------------------------------- State ---------------------------------- */

// An account whose name is its address says the address once, not twice.
const secondLine = computed(() => (props.email === props.name ? undefined : props.email))
</script>

<template>
  <div :class="headerClasses">
    <Avatar :name="props.name" size="md" />
    <div :class="headerTextClasses">
      <p :class="headerNameClasses">{{ props.name }}</p>
      <p v-if="secondLine" :class="headerEmailClasses">{{ secondLine }}</p>
    </div>
  </div>
</template>
