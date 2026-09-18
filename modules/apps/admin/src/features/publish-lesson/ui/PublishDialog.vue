<script setup lang="ts">
import { AlertDialog } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { PublishDialogEmits, PublishDialogProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PublishDialogProps>(), {
  open: false,
  busy: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PublishDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// The consequence, not a question: publishing freezes the text students answer
// against, and the reason a refusal gave belongs in the same place.
const description = computed(() =>
  props.error ? props.error : $t('publish-confirm-body', { version: props.version }),
)

/* -------------------------------- Handlers -------------------------------- */

function onOpen(open: boolean) {
  emit('update:open', open)
}

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog
    :open="props.open"
    :title="$t('publish-confirm-title')"
    :description="description"
    :confirm-label="$t('publish-confirm-submit')"
    :cancel-label="$t('publish-confirm-cancel')"
    :busy="props.busy"
    @update:open="onOpen"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>
