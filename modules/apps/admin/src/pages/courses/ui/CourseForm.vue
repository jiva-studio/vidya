<script setup lang="ts">
import type { CourseLearningType } from '@vidya/domain'
import { FormActions, FormField, Input, RadioGroup, Textarea } from '@vidya/ui'
import type { RadioOption } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { CourseFormValues } from '@/entities/course'

import { formClasses } from './styles'
import type { CourseFormEmits, CourseFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CourseFormProps>(), {
  busy: false,
  error: undefined,
  submitLabel: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CourseFormEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const submitted = ref(false)

const nameError = computed(() => nameErrorText())

const formats = computed<RadioOption[]>(() => [
  {
    value: 'individual',
    label: $t('course-form-type-individual'),
    description: $t('course-form-type-individual-hint'),
  },
  {
    value: 'group',
    label: $t('course-form-type-group'),
    description: $t('course-form-type-group-hint'),
  },
])

/* -------------------------------- Handlers -------------------------------- */

function onName(value: string) {
  patch({ name: value })
}

function onDescription(value: string) {
  patch({ description: value })
}

function onFormat(value: string) {
  patch({ learningType: value as CourseLearningType })
}

function onSubmit() {
  submitted.value = true
  if (props.modelValue.name.trim().length === 0) return
  emit('submit')
}

function onCancel() {
  emit('cancel')
}

/* -------------------------------- Helpers --------------------------------- */

function patch(values: Partial<CourseFormValues>) {
  emit('update:modelValue', { ...props.modelValue, ...values })
}

function nameErrorText(): string | undefined {
  if (!submitted.value || props.modelValue.name.trim().length > 0) return undefined
  return $t('course-form-name-required')
}
</script>

<template>
  <form :class="formClasses" novalidate @submit.prevent="onSubmit">
    <FormField :label="$t('course-form-name-label')" :error="nameError" required>
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.modelValue.name"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          @update:model-value="onName"
        />
      </template>
    </FormField>

    <FormField :label="$t('course-form-description-label')">
      <template #default="field">
        <Textarea
          :id="field.id"
          :rows="4"
          :model-value="props.modelValue.description"
          :described-by="field.describedBy"
          @update:model-value="onDescription"
        />
      </template>
    </FormField>

    <FormField :label="$t('course-form-type-label')">
      <RadioGroup
        :model-value="props.modelValue.learningType"
        :options="formats"
        @update:model-value="onFormat"
      />
    </FormField>

    <FormActions
      :submit-label="props.submitLabel ?? $t('course-form-submit')"
      :cancel-label="$t('course-form-cancel')"
      :busy="props.busy"
      :error="props.error"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </form>
</template>
