<script setup lang="ts">
import { AlertDialog, Button, FormField } from '@vidya/ui'
import { computed } from 'vue'

import type { ReviewActionsEmits, ReviewActionsProps } from '../types'
import GradeInput from './GradeInput.vue'
import { actionsClasses, errorClasses, gradeClasses, hintClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ReviewActionsProps>(), {
  grade: undefined,
  canGrade: false,
  busy: false,
  error: undefined,
  confirming: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ReviewActionsEmits>()

/* --------------------------------- State ---------------------------------- */

const gradeGiven = computed(() => props.grade !== undefined && props.grade >= 0)

/* -------------------------------- Handlers -------------------------------- */

function onGrade(value: number | undefined) {
  emit('update:grade', value)
}

function onAccept() {
  emit('accept')
}

function onReturnAsked() {
  emit('update:confirming', true)
}

function onConfirming(open: boolean) {
  emit('update:confirming', open)
}

function onReturnConfirmed() {
  emit('update:confirming', false)
  emit('return')
}
</script>

<template>
  <div v-if="props.canGrade" :class="actionsClasses">
    <FormField v-slot="field" :class="gradeClasses" :label="$t('homework-grade')" required>
      <GradeInput
        :id="field.id"
        :model-value="props.grade"
        :described-by="field.describedBy"
        @update:model-value="onGrade"
      />
    </FormField>
    <Button :busy="props.busy" :disabled="!gradeGiven" @click="onAccept">
      {{ $t('homework-accept') }}
    </Button>
    <Button variant="ghost" :busy="props.busy" @click="onReturnAsked">
      {{ $t('homework-return') }}
    </Button>
    <p :class="hintClasses">{{ $t('homework-keys-hint') }}</p>
    <p v-if="props.error" :class="errorClasses" role="alert">{{ props.error }}</p>
    <AlertDialog
      :open="props.confirming"
      destructive
      :title="$t('homework-return-title')"
      :description="$t('homework-return-consequence')"
      :confirm-label="$t('homework-return')"
      :cancel-label="$t('action-cancel')"
      :busy="props.busy"
      @update:open="onConfirming"
      @confirm="onReturnConfirmed"
    />
  </div>
</template>
