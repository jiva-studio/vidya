<script setup lang="ts">
import { Badge } from '@vidya/ui'
import { computed } from 'vue'

import { describePlace } from '@/shared/lib'
import { mutedClasses, sectionClasses } from '@/shared/ui'

import { toOfferedHours } from '../model'
import type { PlaceSummaryProps } from '../types'
import PlaceHours from './PlaceHours.vue'
import { placeClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<PlaceSummaryProps>()

/* --------------------------------- State ---------------------------------- */

const badge = computed(() => describePlace(props.place.status))

// The group the school put the student in, where there is one; the group they
// asked for is a wish and stays one until the school answers with its own.
const group = computed(() => props.group?.name ?? null)

const preferred = computed(() => props.preferredGroup?.name ?? null)

const hours = computed(() => toOfferedHours(props.place.preferredTimes))
</script>

<template>
  <div :class="placeClasses">
    <Badge :tone="badge.tone">{{ $t(badge.key) }}</Badge>

    <div :class="sectionClasses">
      <p v-if="group">{{ $t('place-group') }}: {{ group }}</p>
      <p v-else-if="preferred" :class="mutedClasses">
        {{ $t('place-group-preferred') }}: {{ preferred }}
      </p>
      <p v-else :class="mutedClasses">{{ $t('place-group-none') }}</p>

      <PlaceHours v-if="hours.length > 0" :offers="hours" />

      <p v-if="place.comment">{{ $t('place-comment') }}: {{ place.comment }}</p>
    </div>
  </div>
</template>
