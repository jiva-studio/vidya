<script setup lang="ts">
import { Spinner } from '@vidya/ui'

import { backfillClasses, mutedClasses } from './styles'
import type { BackfillProgressProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The first minutes after joining are the one time there is nothing to show
// and nothing wrong. How far it has got is counted in records rather than in
// percent, because a pull answers with a page and whether there is more — the
// protocol never says how much a backfill will bring.
withDefaults(defineProps<BackfillProgressProps>(), { running: true })
</script>

<template>
  <div :class="backfillClasses">
    <p>{{ $t('backfill-title') }}</p>
    <Spinner v-if="running" size="sm" :label="$t('backfill-running')" />
    <p :class="mutedClasses">{{ $t('backfill-rows', { rows }) }}</p>
  </div>
</template>
