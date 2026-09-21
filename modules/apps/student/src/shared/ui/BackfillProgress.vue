<script setup lang="ts">
import { Spinner } from '@vidya/ui'

import { backfillClasses } from './styles'
import type { BackfillProgressProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The first minutes after joining are the one time there is nothing to show
// and nothing wrong.
withDefaults(defineProps<BackfillProgressProps>(), { running: true })
</script>

<template>
  <div :class="backfillClasses">
    <p>{{ $t('waiting-title') }}</p>
    <Spinner v-if="running" size="sm" :label="$t('waiting-running')" />
  </div>
</template>
