<script setup lang="ts">
import { Avatar, Button, EmptyState, FailureState, Spinner } from '@vidya/ui'
import { computed, onMounted } from 'vue'

import { useConnection } from '@/shared/connection'
import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, mutedClasses } from '@/shared/ui'

import { noticeFor, useJoinSchool } from '../model'
import type { JoinPanelEmits, JoinPanelProps } from '../types'
import { panelClasses, schoolClasses, schoolNameClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<JoinPanelProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<JoinPanelEmits>()

/* --------------------------------- State ---------------------------------- */

const { school, stage, resolve, join, retry } = useJoinSchool(props.code)
const status = useSiteStatus()
const { isSignedIn } = useConnection()

const notice = computed(() => noticeFor(stage.value))
const isBusy = computed(() => stage.value === 'joining')
const canJoin = computed(() => stage.value === 'ready' || isBusy.value)
const hasJoined = computed(() => stage.value === 'joined')

// Signing in comes first for a visitor who has no session, and the button says
// so rather than asking them to join and failing.
const joinLabel = computed(() => (isSignedIn.value ? 'join-action' : 'join-sign-in'))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void resolve()
})

/* -------------------------------- Handlers -------------------------------- */

function onJoin() {
  if (!isSignedIn.value) {
    emit('sign-in')
    return
  }

  void join()
}

function onRetry() {
  void retry()
}

function onOpenHome() {
  emit('joined')
}
</script>

<template>
  <div :class="panelClasses">
    <Spinner v-if="stage === 'resolving'" :label="$t('join-resolving')" />

    <FailureState
      v-else-if="notice?.retry"
      :title="$t(notice.title)"
      :description="$t(notice.text)"
      :retry-label="$t('join-retry')"
      @retry="onRetry"
    />

    <EmptyState v-else-if="notice" :title="$t(notice.title)" :description="$t(notice.text)" />

    <template v-else-if="school">
      <div :class="schoolClasses">
        <Avatar :name="school.name" :src="school.logoUrl ?? undefined" size="lg" />
        <span :class="schoolNameClasses">{{ school.name }}</span>
      </div>

      <template v-if="canJoin">
        <p :class="mutedClasses">{{ $t('join-invitation') }}</p>
        <Button :busy="isBusy" :busy-label="$t('join-joining')" @click="onJoin">
          {{ $t(joinLabel) }}
        </Button>
      </template>

      <template v-else-if="hasJoined">
        <p>{{ $t('join-joined') }}</p>
        <BackfillProgress :running="status.syncing.value" />
        <Button @click="onOpenHome">{{ $t('join-open-home') }}</Button>
      </template>
    </template>
  </div>
</template>
