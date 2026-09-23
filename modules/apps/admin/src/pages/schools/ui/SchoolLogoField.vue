<script setup lang="ts">
import { FormField } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { useMediaGateway } from '@/entities/media'
import { MediaPickerDialog } from '@/features/pick-media'

import SchoolLogoDropzone from './SchoolLogoDropzone.vue'
import SchoolLogoPreview from './SchoolLogoPreview.vue'
import type { SchoolLogoFieldProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SchoolLogoFieldProps>(), {
  modelValue: '',
  error: undefined,
  disabled: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const gateway = useMediaGateway()
const pickerOpen = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

const resolvedSrc = computed(() => {
  if (!props.modelValue) return ''
  const resolved = gateway.resolve(props.modelValue)
  if (resolved) return resolved
  return props.modelValue
})

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', value)
}

function onOpenPicker() {
  if (props.disabled) return
  pickerOpen.value = true
}

function onPickerClose(open: boolean) {
  pickerOpen.value = open
}

function onPick(picked: PickedMedia) {
  emit('update:modelValue', picked.url)
}

function onRemove() {
  if (props.disabled) return
  emit('update:modelValue', '')
}
</script>

<template>
  <FormField :label="$t('schools-form-logo')" :error="props.error">
    <template #default="field">
      <div class="flex flex-col gap-3" data-test="school-logo-field">
        <input
          :id="field.id"
          class="sr-only"
          :value="props.modelValue"
          name="logoUrl"
          :disabled="props.disabled"
          @input="onInput(($event.target as HTMLInputElement).value)"
        />

        <SchoolLogoPreview
          v-if="hasImage"
          :src="resolvedSrc"
          :disabled="props.disabled"
          @change="onOpenPicker"
          @remove="onRemove"
        />

        <SchoolLogoDropzone
          v-else
          :error="props.error"
          :disabled="props.disabled"
          @click="onOpenPicker"
        />
      </div>
    </template>
  </FormField>

  <MediaPickerDialog
    :open="pickerOpen"
    kind="image"
    accept="image/*"
    @update:open="onPickerClose"
    @pick="onPick"
  />
</template>
