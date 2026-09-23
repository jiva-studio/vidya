<script setup lang="ts">
import { IconButton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { Pencil, Trash2, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { useMediaGateway } from '@/entities/media'
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
const gateway = useMediaGateway()
const pickerOpen = ref(false)
const loadFailed = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

function placeholderSvg(title: string): string {
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <rect width="100%" height="100%" fill="#f1f5f9" rx="8"/>
    <circle cx="200" cy="100" r="36" fill="#e2e8f0"/>
    <path d="M120 190 C150 140, 250 140, 280 190" fill="#cbd5e1"/>
    <text x="200" y="215" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#64748b" text-anchor="middle">${safeTitle}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const resolvedSrc = computed(() => {
  if (!props.modelValue) return ''
  const resolved = gateway.resolve(props.modelValue)
  if (resolved) return resolved
  if (props.modelValue.startsWith('/media/')) {
    return placeholderSvg('Cover')
  }
  return props.modelValue
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
      <img
        :src="loadFailed ? placeholderSvg('Cover') : resolvedSrc"
        alt="Course cover"
        class="h-20 w-32 object-cover rounded-md"
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
      class="w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer bg-white hover:bg-slate-100 border-slate-300 hover:border-slate-400 group"
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
