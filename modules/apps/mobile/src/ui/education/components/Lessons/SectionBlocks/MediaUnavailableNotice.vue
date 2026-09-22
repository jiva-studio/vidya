<template>
  <div class="unavailable" data-testid="media-unavailable">
    <IonNote>{{ $t(messageKey) }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonNote } from '@ionic/vue'
import { computed } from 'vue'

import type { MediaUnavailableReason } from '../../../model/sectionMedia'
import type { MediaUnavailableNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaUnavailableNoticeProps>(), {
  reason: 'needs-connection',
})

/* --------------------------------- State ---------------------------------- */

const messages: Readonly<Record<MediaUnavailableReason, string>> = {
  'needs-connection': 'media-needs-connection',
  'not-permitted': 'media-not-permitted',
}

const messageKey = computed(() => messages[props.reason])
</script>

<style scoped>
.unavailable {
  display: flex;
  padding: 16px;
}
</style>
