<script setup lang="ts">
import { useConnection } from '@/shared/connection'
import { useSiteStatus } from '@/shared/status'
import { mutedClasses, sectionClasses, titleClasses } from '@/shared/ui'

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { isSignedIn } = useConnection()
</script>

<template>
  <section :class="sectionClasses">
    <h2 :class="titleClasses">{{ $t('settings-sync-title') }}</h2>

    <p v-if="!isSignedIn" :class="mutedClasses">{{ $t('sync-signed-out') }}</p>
    <p v-else-if="status.syncing.value" :class="mutedClasses">{{ $t('sync-running') }}</p>
    <p v-else-if="status.firstRunCompleted.value" :class="mutedClasses">
      {{ $t('sync-idle', { rows: status.done.value }) }}
    </p>
    <p v-else :class="mutedClasses">{{ $t('sync-never') }}</p>

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
