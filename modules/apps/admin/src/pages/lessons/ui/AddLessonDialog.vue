<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogFooter,
  FormField,
  Input,
  Select,
  type SelectOption,
} from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref, watch } from 'vue'

import type { AddLessonDialogEmits, AddLessonDialogProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AddLessonDialogProps>(), {
  open: false,
  busy: false,
  error: undefined,
  courseId: undefined,
  courses: () => [],
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AddLessonDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const title = ref('')
const selectedCourseId = ref(props.courseId ?? '')
const submitted = ref(false)

const showCourseSelect = computed(() => !props.courseId && props.courses.length > 0)
const courseSelectOptions = computed<SelectOption[]>(() =>
  props.courses.map((c) => ({ value: c.id, label: c.name })),
)

const titleError = computed(() => titleErrorText())
const courseError = computed(() => courseErrorText())

watch(
  () => props.courseId,
  (next) => {
    if (next) selectedCourseId.value = next
  },
)

/* -------------------------------- Handlers -------------------------------- */

function onTitle(value: string) {
  title.value = value
}

function onCourseChange(value: string) {
  selectedCourseId.value = value
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
  if (showCourseSelect.value && !selectedCourseId.value) return
  emit('submit', title.value.trim(), selectedCourseId.value || props.courseId)
}

/* -------------------------------- Helpers --------------------------------- */

function reset() {
  title.value = ''
  selectedCourseId.value = props.courseId ?? props.courses[0]?.id ?? ''
  submitted.value = false
}

function titleErrorText(): string | undefined {
  if (!submitted.value || title.value.trim().length > 0) return undefined
  return $t('lesson-create-title-required')
}

function courseErrorText(): string | undefined {
  if (!submitted.value || !showCourseSelect.value || selectedCourseId.value) return undefined
  return $t('lesson-create-course-required')
}
</script>

<template>
  <Dialog :open="props.open" :title="$t('lesson-create-title')" @update:open="onOpen">
    <FormField
      v-if="showCourseSelect"
      :label="$t('lesson-create-course-label')"
      :error="courseError"
      required
    >
      <template #default="field">
        <Select
          :id="field.id"
          :model-value="selectedCourseId"
          :options="courseSelectOptions"
          :placeholder="$t('lesson-create-course-placeholder')"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          @update:model-value="onCourseChange"
        />
      </template>
    </FormField>
    <FormField :label="$t('lesson-create-title-label')" :error="titleError ?? props.error" required>
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="title"
          :placeholder="$t('lesson-create-title-placeholder')"
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
