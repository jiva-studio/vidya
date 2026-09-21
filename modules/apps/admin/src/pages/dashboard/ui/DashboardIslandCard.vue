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

// An empty queue is good news, printed quietly so a full one leads.
const figureClasses = computed(() => (waiting.value > 0 ? countClasses : countQuietClasses))

// A count nobody may read is not zero, and must not be shown as one.
const unreadable = computed(() => isQueue.value && props.island.count === undefined)

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
