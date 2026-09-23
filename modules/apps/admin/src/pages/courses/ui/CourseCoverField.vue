<script setup lang="ts">
import { Button } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { MediaPickerDialog } from '@/features/pick-media'

import type { CourseCoverFieldEmits, CourseCoverFieldProps } from './types'

defineOptions({
  name: 'CourseCoverField',
})

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CourseCoverFieldProps>(), {
  modelValue: null,
  error: undefined,
  disabled: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CourseCoverFieldEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const pickerOpen = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

/* -------------------------------- Handlers -------------------------------- */

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
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="flex flex-col gap-2" data-test="course-cover-field">
    <div v-if="hasImage" class="flex items-start gap-4">
      <img
        :src="props.modelValue!"
        alt="Course cover"
        class="h-32 w-56 rounded-md object-cover border border-slate-200"
      />
      <div class="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-test="change-cover"
          data-action="change"
          aria-label="Change cover"
          :disabled="props.disabled"
          @click="onOpenPicker"
        >
          {{ $t('course-form-cover-change') }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-test="remove-cover"
          data-action="remove"
          aria-label="Remove cover"
          :disabled="props.disabled"
          @click="onRemove"
        >
          {{ $t('course-form-cover-remove') }}
        </Button>
      </div>
    </div>

    <div v-else class="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-test="choose-cover"
        data-action="pick"
        aria-label="Choose cover"
        :disabled="props.disabled"
        @click="onOpenPicker"
      >
        {{ $t('course-form-cover-choose') }}
      </Button>
    </div>

    <p v-if="props.error" class="text-xs text-rose-500">{{ props.error }}</p>

    <MediaPickerDialog
      :open="pickerOpen"
      kind="image"
      accept="image/*"
      @update:open="onPickerClose"
      @pick="onPick"
    />
  </div>
</template>
