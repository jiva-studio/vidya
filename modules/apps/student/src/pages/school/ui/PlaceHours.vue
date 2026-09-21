<script setup lang="ts">
import { mutedClasses, sectionClasses } from '@/shared/ui'

import type { PlaceHoursProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<PlaceHoursProps>()
</script>

<template>
  <div :class="sectionClasses">
    <p :class="mutedClasses">{{ $t('place-times') }}</p>
    <p v-for="offer in props.offers" :key="offer.hours" :class="mutedClasses">
      <span v-for="day in offer.days" :key="day">{{ $t(`weekday-short-${day}`) }}</span>
      {{ offer.hours }}
    </p>
  </div>
</template>
