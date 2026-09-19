<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { Input, Label, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import type { ComponentPublicInstance } from 'vue'
import { computed, onMounted, ref, useId } from 'vue'

import {
  hintClasses,
  propertyControlClasses,
  propertyRowClasses,
  sectionFormClasses,
  sectionHeadingClasses,
  sectionTitleInputClasses,
} from './styles'
import type { SectionFormEmits, SectionFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionFormProps>(), { frozen: false, autofocus: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionFormEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const title = ref<ComponentPublicInstance | null>(null)
const homeworkId = useId()

const assessments: LessonSection['assessment'][] = ['none', 'auto', 'teacher']

const options = computed(() =>
  assessments.map((value) => ({ value, label: $t(`editor-homework-${value}`) })),
)

const asked = computed(() => props.section.assessment !== 'none')

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  if (props.autofocus && !props.frozen) focusTitle()
})

/* -------------------------------- Handlers -------------------------------- */

function onTitle(value: string) {
  emit('rename', props.section.id, value)
}

function onAssessment(value: string) {
  emit('assessment', props.section.id, value as LessonSection['assessment'])
}

/* -------------------------------- Helpers --------------------------------- */

function focusTitle() {
  const element = title.value?.$el
  if (element instanceof HTMLInputElement) element.focus()
}
</script>

<template>
  <div :class="sectionFormClasses">
    <div :class="sectionHeadingClasses">
      <Input
        ref="title"
        :model-value="props.section.title"
        :readonly="props.frozen"
        :class="sectionTitleInputClasses"
        :aria-label="$t('editor-section-title-label')"
        :placeholder="$t('editor-section-untitled')"
        @update:model-value="onTitle"
      />
      <slot name="actions" />
    </div>
    <div :class="propertyRowClasses">
      <Label :for="homeworkId">{{ $t('editor-homework-label') }}</Label>
      <Select
        :id="homeworkId"
        :model-value="props.section.assessment"
        :options="options"
        :placeholder="$t('editor-homework-placeholder')"
        :disabled="props.frozen"
        :class="propertyControlClasses"
        @update:model-value="onAssessment"
      />
    </div>
    <p v-if="asked" :class="hintClasses">{{ $t('editor-homework-note') }}</p>
  </div>
</template>
