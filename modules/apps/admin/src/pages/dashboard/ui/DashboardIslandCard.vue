<script setup lang="ts">
import { Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { ArrowRight } from 'lucide-vue-next'
import { computed } from 'vue'

import {
  actionClasses,
  cardClasses,
  countClasses,
  countQuietClasses,
  islandBodyClasses,
  islandIconClasses,
  islandTitleClasses,
  noteClasses,
} from './styles'
import type { DashboardIslandCardEmits, DashboardIslandCardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DashboardIslandCardProps>(), { loading: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<DashboardIslandCardEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const title = computed(() => $t(`dashboard-${props.island.key}-title`))
const action = computed(() => $t(`dashboard-${props.island.key}-action`))

const isQueue = computed(() => props.island.kind === 'queue')
const waiting = computed(() => props.island.count ?? 0)

// Nothing waiting is still a number, and it is the good news: it is printed
// quietly so a full queue beside it is the thing the eye lands on.
const figureClasses = computed(() => (waiting.value > 0 ? countClasses : countQuietClasses))

// A count nobody was allowed to read is not zero, and a card that showed one
// would tell a reviewer their queue was empty when they simply cannot see it.
const unreadable = computed(() => isQueue.value && props.island.count === undefined)

// The whole card is the link, so the figure and the words are part of the
// target rather than a label beside a small one.
const note = computed(() => (unreadable.value ? $t('dashboard-count-unreadable') : undefined))

/* -------------------------------- Handlers -------------------------------- */

function onOpen() {
  emit('open', props.island.route)
}
</script>

<template>
  <button type="button" :class="cardClasses" @click="onOpen">
    <span :class="islandBodyClasses">
      <span :class="islandTitleClasses">{{ title }}</span>
      <Skeleton v-if="props.loading && isQueue" shape="text" :lines="1" />
      <span v-else-if="note" :class="noteClasses">{{ note }}</span>
      <span v-else-if="isQueue" :class="figureClasses">{{ waiting }}</span>
    </span>
    <span :class="actionClasses">
      {{ action }}
      <ArrowRight :class="islandIconClasses" />
    </span>
  </button>
</template>
