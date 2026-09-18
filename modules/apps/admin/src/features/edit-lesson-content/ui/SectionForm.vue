<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { FormField, Input, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { fieldStackClasses } from './styles'
import type { SectionFormEmits, SectionFormProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionFormProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionFormEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const assessments: LessonSection['assessment'][] = ['none', 'auto', 'teacher']

const assessmentOptions = computed(() =>
  assessments.map((value) => ({ value, label: $t(`editor-assessment-${value}`) })),
)

/* -------------------------------- Handlers -------------------------------- */

function onTitle(title: string) {
  emit('rename', props.section.id, title)
}

function onAssessment(assessment: string) {
  emit('assessment', props.section.id, assessment as LessonSection['assessment'])
}
</script>

<template>
  <div :class="fieldStackClasses">
    <FormField :label="$t('editor-section-title-label')">
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.section.title"
          :described-by="field.describedBy"
          :readonly="props.frozen"
          @update:model-value="onTitle"
        />
      </template>
    </FormField>
    <FormField :label="$t('editor-assessment-label')" :hint="$t('editor-assessment-hint')">
      <template #default="field">
        <Select
          :id="field.id"
          :model-value="props.section.assessment"
          :options="assessmentOptions"
          :disabled="props.frozen"
          @update:model-value="onAssessment"
        />
      </template>
    </FormField>
  </div>
</template>
