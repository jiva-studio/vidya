<script setup lang="ts">
import { AlertDialog, Badge, Button } from '@vidya/ui'
import { computed, ref } from 'vue'

import { translate } from '@/shared/i18n'
import { mutedClasses, sectionClasses } from '@/shared/ui'
import { useOutboxView } from '@/shared/sync'

import { describePlaceAction, describeRejection } from '../model'
import type { PlaceDispatchEmits, PlaceDispatchProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<PlaceDispatchProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PlaceDispatchEmits>()

/* --------------------------------- State ---------------------------------- */

const outbox = useOutboxView()
const asking = ref(false)

const state = computed(() => outbox.state('enrollments', props.place.id))

const refusal = computed(() => {
  if (state.value !== 'rejected') return null

  const reason = outbox.reason('enrollments', props.place.id)

  return reason === undefined ? null : describeRejection(reason)
})

const offer = computed(() => describePlaceAction(props.place))

const question = computed(() =>
  offer.value.confirmation ? translate(offer.value.confirmation) : '',
)

/* -------------------------------- Handlers -------------------------------- */

function onOfferClicked() {
  if (offer.value.confirmation) asking.value = true
  else emit('act', offer.value.action)
}

function onConfirmed() {
  asking.value = false
  emit('act', offer.value.action)
}
</script>

<template>
  <div :class="sectionClasses">
    <Badge tone="neutral">{{ $t(`submission-${state}`) }}</Badge>

    <template v-if="refusal">
      <p>{{ $t(refusal) }}</p>
      <p :class="mutedClasses">{{ $t('place-rejected-kept') }}</p>
    </template>

    <Button :variant="offer.variant" :disabled="props.busy" @click="onOfferClicked">
      {{ $t(offer.label) }}
    </Button>

    <AlertDialog
      v-model:open="asking"
      :title="$t(offer.label)"
      :description="question"
      :confirm-label="$t(offer.label)"
      destructive
      @confirm="onConfirmed"
    />
  </div>
</template>
