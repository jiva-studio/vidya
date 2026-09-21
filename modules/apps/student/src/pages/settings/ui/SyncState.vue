<script setup lang="ts">
import { computed } from 'vue'

import { useConnection } from '@/shared/connection'
import { useSiteStatus } from '@/shared/status'
import { mutedClasses, sectionClasses, titleClasses } from '@/shared/ui'

import { pickSyncView } from '../model'

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { isSignedIn } = useConnection()

const view = computed(() =>
  pickSyncView({
    signedIn: isSignedIn.value,
    syncing: status.syncing.value,
    firstRunCompleted: status.firstRunCompleted.value,
    received: status.received.value,
  }),
)
</script>

<template>
  <section :class="sectionClasses">
    <h2 :class="titleClasses">{{ $t('settings-sync-title') }}</h2>

    <p v-if="view === 'signed-out'" :class="mutedClasses">{{ $t('sync-signed-out') }}</p>
    <p v-else-if="view === 'running'" :class="mutedClasses">{{ $t('sync-running') }}</p>
    <p v-else-if="view === 'never'" :class="mutedClasses">{{ $t('sync-never') }}</p>
    <p v-else-if="view === 'empty'" :class="mutedClasses">{{ $t('sync-empty') }}</p>
    <p v-else :class="mutedClasses">{{ $t('sync-idle', { rows: status.done.value }) }}</p>

    <p v-if="status.writing.value" :class="mutedClasses">{{ $t('sync-tab-writer') }}</p>
    <p v-else :class="mutedClasses">{{ $t('sync-tab-reader') }}</p>

    <p v-if="status.storage.value === 'persistent'" :class="mutedClasses">
      {{ $t('storage-persistent') }}
    </p>
    <p v-else-if="status.storage.value === 'temporary'" :class="mutedClasses">
      {{ $t('storage-temporary') }}
    </p>
    <p v-else :class="mutedClasses">{{ $t('storage-unknown') }}</p>
  </section>
</template>
