<script setup lang="ts">
import { IconButton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { Pencil, Trash2, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { useMediaGateway } from '@/entities/media'
import { MediaPickerDialog } from '@/features/pick-media'

import CourseCoverPlaceholder from './CourseCoverPlaceholder.vue'
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
const gateway = useMediaGateway()
const pickerOpen = ref(false)
const loadFailed = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

const resolvedSrc = computed(() => {
  if (!props.modelValue) return ''
  const resolved = gateway.resolve(props.modelValue)
  if (resolved) return resolved
  return props.modelValue
})

const showPlaceholder = computed(() => {
  if (loadFailed.value) return true
  if (
    props.modelValue &&
    props.modelValue.startsWith('/media/') &&
    !gateway.resolve(props.modelValue)
  ) {
    return true
  }
  return false
})

/* -------------------------------- Handlers -------------------------------- */

function onOpenPicker() {
  if (props.disabled) return
  pickerOpen.value = true
}

function onPickerClose(open: boolean) {
  pickerOpen.value = open
}

function onPick(picked: PickedMedia) {
  loadFailed.value = false
  emit('update:modelValue', picked.url)
}

function onRemove() {
  if (props.disabled) return
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="flex flex-col gap-2" data-test="course-cover-field">
    <!-- When image is chosen -->
    <div
      v-if="hasImage"
      class="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
    >
      <CourseCoverPlaceholder v-if="showPlaceholder" title="Cover" class="h-20 w-32 shrink-0" />
      <img
        v-else
        :src="resolvedSrc"
        alt="Course cover"
        class="h-20 w-32 object-cover rounded-md shrink-0"
        @error="loadFailed = true"
      />
      <IconButton
        variant="ghost"
        size="sm"
        :label="$t('course-form-cover-change')"
        :disabled="props.disabled"
        data-test="change-cover"
        data-action="change"
        class="ml-auto text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        @click="onOpenPicker"
      >
        <Pencil class="h-4 w-4" />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        :label="$t('course-form-cover-remove')"
        :disabled="props.disabled"
        data-test="remove-cover"
        data-action="remove"
        class="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
        @click="onRemove"
      >
        <Trash2 class="h-4 w-4" />
      </IconButton>
    </div>

    <!-- When no image is chosen (Empty Drop Area) -->
    <div
      v-else
      class="w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer bg-[var(--color-surface-sunken)] hover:bg-[var(--color-border)] border-[var(--color-border-strong)] hover:border-slate-400 group"
      :class="[
        props.error ? 'border-rose-300 bg-rose-50/20 hover:bg-rose-50/40' : '',
        props.disabled ? 'opacity-50 pointer-events-none' : '',
      ]"
      data-test="cover-drop-area"
      @click="onOpenPicker"
    >
      <Upload class="h-8 w-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
      <span
        class="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors"
        data-test="choose-cover"
      >
        {{ $t('course-form-cover-drop') }}
      </span>
      <span class="text-xs text-slate-400">PNG, JPG, WebP, SVG</span>
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
