<script setup lang="ts">
import type { GroupId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { Button, Dialog, DialogFooter, FormField, Select } from '@vidya/ui'
import { ref, watch } from 'vue'

import { useDirectoryApi } from '@/entities/enrollment'

import type { GroupAssignDialogEmits, GroupAssignDialogProps } from '../types'
import { bodyClasses, errorClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupAssignDialogProps>(), {
  open: false,
  courseId: undefined,
  groupId: undefined,
  busy: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupAssignDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const api = useDirectoryApi()
const options = ref<SelectOption[]>([])
const selected = ref<string>('')

/* ---------------------------------- Hooks --------------------------------- */

watch(
  () => [props.open, props.courseId],
  () => {
    if (props.open) void load()
  },
  { immediate: true },
)

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  emit('update:open', open)
}

function onSubmit() {
  emit('submit', selected.value ? (selected.value as GroupId) : null)
}

/* -------------------------------- Helpers --------------------------------- */

async function load() {
  selected.value = props.groupId ?? ''
  if (!props.courseId) return

  const response = await api.groups(props.courseId)
  options.value = response.items.map((item) => ({ value: item.id, label: item.name }))
}
</script>

<template>
  <Dialog
    :open="props.open"
    :title="$t('enrollments-group-title')"
    :description="$t('enrollments-group-description')"
    :close-label="$t('action-close')"
    @update:open="onOpenChange"
  >
    <div :class="bodyClasses">
      <FormField
        v-slot="field"
        :label="$t('enrollments-group-label')"
        :hint="$t('enrollments-group-hint')"
      >
        <Select
          :id="field.id"
          v-model="selected"
          :options="options"
          :described-by="field.describedBy"
          :placeholder="$t('enrollments-group-queue')"
        />
      </FormField>
      <p v-if="props.error" :class="errorClasses" role="alert">{{ props.error }}</p>
    </div>
    <template #footer>
      <DialogFooter>
        <Button variant="secondary" @click="onOpenChange(false)">{{ $t('action-cancel') }}</Button>
        <Button :busy="props.busy" @click="onSubmit">{{ $t('enrollments-group-save') }}</Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>
