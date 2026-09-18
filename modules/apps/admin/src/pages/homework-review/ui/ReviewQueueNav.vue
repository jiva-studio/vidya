<script setup lang="ts">
import { Button, Tooltip } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { countClasses, linkClasses, navClasses } from './styles'
import type { ReviewQueueNavEmits, ReviewQueueNavProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<ReviewQueueNavProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ReviewQueueNavEmits>()

/* --------------------------------- State ---------------------------------- */

const hasNext = computed(() => props.remaining > 0)

const toList = { name: 'homework-queue' }

/* -------------------------------- Handlers -------------------------------- */

function onNext() {
  emit('next')
}
</script>

<template>
  <div :class="navClasses">
    <Tooltip v-if="hasNext" :text="$t('homework-key-next')">
      <Button variant="secondary" @click="onNext">{{ $t('homework-next') }}</Button>
    </Tooltip>
    <span v-if="hasNext" :class="countClasses">
      {{ $t('homework-remaining', { count: props.remaining }) }}
    </span>
    <span v-else :class="countClasses">{{ $t('homework-queue-empty') }}</span>
    <RouterLink v-if="!hasNext" :to="toList" :class="linkClasses">
      {{ $t('homework-back-to-list') }}
    </RouterLink>
  </div>
</template>
