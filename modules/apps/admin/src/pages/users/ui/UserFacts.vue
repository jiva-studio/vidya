<script setup lang="ts">
import { factClasses, factLabelClasses, factsClasses } from './styles'
import type { UserFactsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UserFactsProps>()
</script>

<template>
  <dl :class="factsClasses">
    <div :class="factClasses">
      <dt :class="factLabelClasses">{{ $t('users-card-email') }}</dt>
      <dd>{{ props.user.email }}</dd>
    </div>
  </dl>
</template>
