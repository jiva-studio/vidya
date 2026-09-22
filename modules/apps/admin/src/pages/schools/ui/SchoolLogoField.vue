<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { MediaPickerDialog } from '@/features/pick-media'

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
const pickerOpen = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

/* -------------------------------- Handlers -------------------------------- */

function onInput(value: string) {
  emit('update:modelValue', value)
}

function onOpenPicker() {
  pickerOpen.value = true
}

function onPickerClose(open: boolean) {
  pickerOpen.value = open
}

function onPick(picked: PickedMedia) {
  emit('update:modelValue', picked.url)
}

function onRemove() {
  emit('update:modelValue', '')
}
</script>

<template>
  <FormField :label="$t('schools-form-logo')" :error="props.error">
    <template #default="field">
      <div class="flex flex-col gap-3">
        <div v-if="hasImage" class="flex items-center gap-4">
          <img
            :src="props.modelValue"
            alt="School logo"
            class="h-16 w-16 rounded-md object-cover border border-slate-200"
          />
          <div class="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-test="open-picker"
              data-action="pick"
              aria-label="Change logo"
              :disabled="props.disabled"
              @click="onOpenPicker"
            >
              {{ $t('schools-form-logo-change') }}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-test="remove-logo"
              data-action="remove"
              aria-label="Remove logo"
              :disabled="props.disabled"
              @click="onRemove"
            >
              {{ $t('schools-form-logo-remove') }}
            </Button>
          </div>
        </div>

        <div v-else class="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-test="open-picker"
            data-action="pick"
            aria-label="Choose logo"
            :disabled="props.disabled"
            @click="onOpenPicker"
          >
            {{ $t('schools-form-logo-choose') }}
          </Button>
        </div>

        <Input
          :id="field.id"
          :model-value="props.modelValue"
          name="logoUrl"
          :placeholder="$t('schools-form-logo-hint')"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          :disabled="props.disabled"
          @update:model-value="onInput"
        />

        <MediaPickerDialog
          :open="pickerOpen"
          kind="image"
          accept="image/*"
          @update:open="onPickerClose"
          @pick="onPick"
        />
      </div>
    </template>
  </FormField>
</template>
