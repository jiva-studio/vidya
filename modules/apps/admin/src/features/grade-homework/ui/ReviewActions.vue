<script setup lang="ts">
import { AlertDialog, Button, FormField, Tooltip } from '@vidya/ui'
import { computed } from 'vue'

import { isGradeGiven } from '../model'
import type { ReviewActionsEmits, ReviewActionsProps } from '../types'
import GradePicker from './GradePicker.vue'
import { actionsClasses, errorClasses } from './styles'

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

const gradeGiven = computed(() => isGradeGiven(props.grade))

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
    <FormField
      v-slot="field"
      :label="$t('homework-grade')"
      :hint="$t('homework-grade-range')"
      required
    >
      <GradePicker
        :id="field.id"
        :model-value="props.grade"
        :described-by="field.describedBy"
        @update:model-value="onGrade"
      />
    </FormField>
    <Tooltip :text="$t('homework-key-accept')">
      <Button :busy="props.busy" :disabled="!gradeGiven" @click="onAccept">
        {{ $t('homework-accept') }}
      </Button>
    </Tooltip>
    <Tooltip :text="$t('homework-key-return')">
      <Button variant="ghost" :busy="props.busy" @click="onReturnAsked">
        {{ $t('homework-return') }}
      </Button>
    </Tooltip>
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
