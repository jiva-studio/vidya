<script setup lang="ts">
import { Combobox, FormField, FormFooter, Input, Textarea } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { GroupFormValues } from '@/entities/group'

import { formClasses } from './styles'
import type { GroupFormEmits, GroupFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupFormProps>(), {
  courseLocked: false,
  busy: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupFormEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const submitted = ref(false)

const nameError = computed(() => errorFor('name', 'group-form-name-required'))
const courseError = computed(() => errorFor('courseId', 'group-form-course-required'))
const courseHint = computed(() =>
  props.courseLocked ? $t('group-form-course-locked') : $t('group-form-course-hint'),
)

// A locked field is read, not searched, and a combobox handed an identifier it
// has no option for falls back to printing the identifier. A plain read-only
// input shows the name or nothing, and never a UUID.
const courseName = computed(
  () => props.courses.find((course) => course.value === props.modelValue.courseId)?.label ?? '',
)

/* -------------------------------- Handlers -------------------------------- */

function onName(value: string) {
  patch({ name: value })
}

function onCourse(value: string) {
  patch({ courseId: value })
}

function onDescription(value: string) {
  patch({ description: value })
}

function onSubmit() {
  submitted.value = true
  if (nameError.value || courseError.value) return
  emit('submit')
}

function onCancel() {
  emit('cancel')
}

/* -------------------------------- Helpers --------------------------------- */

function patch(values: Partial<GroupFormValues>) {
  emit('update:modelValue', { ...props.modelValue, ...values })
}

function errorFor(field: 'name' | 'courseId', key: string): string | undefined {
  if (!submitted.value || props.modelValue[field].trim().length > 0) return undefined
  return $t(key)
}
</script>

<template>
  <form :class="formClasses" novalidate @submit.prevent="onSubmit">
    <FormField :label="$t('group-form-name-label')" :error="nameError" required>
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

    <FormField
      :label="$t('group-form-course-label')"
      :hint="courseHint"
      :error="courseError"
      required
    >
      <template #default="field">
        <Input
          v-if="props.courseLocked"
          :id="field.id"
          :model-value="courseName"
          readonly
          :described-by="field.describedBy"
        />
        <Combobox
          v-else
          :id="field.id"
          :empty-label="$t('state-nothing-matches')"
          :model-value="props.modelValue.courseId"
          :options="props.courses"
          :placeholder="$t('groups-course-placeholder')"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          @update:model-value="onCourse"
        />
      </template>
    </FormField>

    <FormField :label="$t('group-form-description-label')">
      <template #default="field">
        <Textarea
          :id="field.id"
          :rows="6"
          :model-value="props.modelValue.description"
          :described-by="field.describedBy"
          @update:model-value="onDescription"
        />
      </template>
    </FormField>

    <FormFooter
      :submit-label="$t('group-form-submit')"
      :cancel-label="$t('group-form-cancel')"
      :busy="props.busy"
      :error="props.error"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </form>
</template>
