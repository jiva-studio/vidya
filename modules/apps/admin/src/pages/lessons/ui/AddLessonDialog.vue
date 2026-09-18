<script setup lang="ts">
import { Button, Dialog, DialogFooter, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { AddLessonDialogEmits, AddLessonDialogProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AddLessonDialogProps>(), {
  open: false,
  busy: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AddLessonDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const title = ref('')
const submitted = ref(false)

const titleError = computed(() => titleErrorText())

/* -------------------------------- Handlers -------------------------------- */

function onTitle(value: string) {
  title.value = value
}

function onOpen(open: boolean) {
  if (!open) reset()
  emit('update:open', open)
}

function onCancel() {
  onOpen(false)
}

function onSubmit() {
  submitted.value = true
  if (title.value.trim().length === 0) return
  emit('submit', title.value.trim())
}

/* -------------------------------- Helpers --------------------------------- */

function reset() {
  title.value = ''
  submitted.value = false
}

function titleErrorText(): string | undefined {
  if (!submitted.value || title.value.trim().length > 0) return undefined
  return $t('lesson-create-title-required')
}
</script>

<template>
  <Dialog
    :open="props.open"
    :title="$t('lesson-create-title')"
    :description="$t('lesson-create-body')"
    @update:open="onOpen"
  >
    <FormField :label="$t('lesson-create-title-label')" :error="titleError ?? props.error" required>
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="title"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          @update:model-value="onTitle"
        />
      </template>
    </FormField>
    <template #footer>
      <DialogFooter>
        <Button variant="secondary" :disabled="props.busy" @click="onCancel">
          {{ $t('lesson-create-cancel') }}
        </Button>
        <Button :busy="props.busy" @click="onSubmit">{{ $t('lesson-create-submit') }}</Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>
