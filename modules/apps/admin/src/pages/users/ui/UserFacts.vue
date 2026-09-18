<script setup lang="ts">
import { computed } from 'vue'

import { factClasses, factLabelClasses, factsClasses } from './styles'
import type { UserFactsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserFactsProps>()

/* --------------------------------- State ---------------------------------- */

// The schema holds a name, an address and a phone. Department, title, avatar
// and status were in the admin this replaces and exist nowhere in ours.
const phone = computed(() => props.user.phone ?? '')
</script>

<template>
  <dl :class="factsClasses">
    <div :class="factClasses">
      <dt :class="factLabelClasses">{{ $t('users-card-email') }}</dt>
      <dd>{{ props.user.email }}</dd>
    </div>
    <div :class="factClasses">
      <dt :class="factLabelClasses">{{ $t('users-card-phone') }}</dt>
      <dd v-if="phone">{{ phone }}</dd>
      <dd v-else>{{ $t('users-card-unknown') }}</dd>
    </div>
  </dl>
</template>
