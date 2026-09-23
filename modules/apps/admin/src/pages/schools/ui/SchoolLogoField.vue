<script setup lang="ts">
import { IconButton, Label } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { Pencil, Trash2, Upload } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'
import { useMediaGateway } from '@/entities/media'
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
const gateway = useMediaGateway()
const pickerOpen = ref(false)
const loadFailed = ref(false)

const hasImage = computed(() => Boolean(props.modelValue && props.modelValue.trim().length > 0))

function placeholderSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="100%" height="100%" fill="#f1f5f9" rx="12"/>
    <path d="M100 45 L155 75 L100 105 L45 75 Z" fill="#0d9488"/>
    <path d="M65 95 L65 135 C65 145, 135 145, 135 135 L135 95" fill="none" stroke="#0d9488" stroke-width="8" stroke-linecap="round"/>
    <path d="M155 75 L155 130" stroke="#0d9488" stroke-width="6" stroke-linecap="round"/>
    <circle cx="155" cy="135" r="5" fill="#0d9488"/>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const resolvedSrc = computed(() => {
  if (!props.modelValue) return ''
  const resolved = gateway.resolve(props.modelValue)
  if (resolved) return resolved
  if (props.modelValue.startsWith('/media/')) {
    return placeholderSvg()
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
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label>{{ $t('schools-form-logo') }}</Label>

    <!-- When image is chosen -->
    <div
      v-if="hasImage"
      class="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
    >
      <img
        :src="loadFailed ? placeholderSvg() : resolvedSrc"
        alt="School logo"
        class="h-16 w-16 object-contain rounded-md"
        @error="loadFailed = true"
      />
      <IconButton
        variant="ghost"
        size="sm"
        :label="$t('schools-form-logo-change')"
        :disabled="props.disabled"
        data-test="open-picker"
        data-action="pick"
        class="ml-auto text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        @click="onOpenPicker"
      >
        <Pencil class="h-4 w-4" />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        :label="$t('schools-form-logo-remove')"
        :disabled="props.disabled"
        data-test="remove-logo"
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
      data-test="logo-drop-area"
      @click="onOpenPicker"
    >
      <Upload class="h-6 w-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
      <span
        class="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors"
        data-test="open-picker"
      >
        {{ $t('schools-form-logo-drop') }}
      </span>
      <span class="text-xs text-slate-400">PNG, JPG, WebP, SVG</span>
    </div>

    <p v-if="props.error" class="text-xs text-rose-500 font-medium">{{ props.error }}</p>

    <MediaPickerDialog
      :open="pickerOpen"
      kind="image"
      accept="image/*"
      @update:open="onPickerClose"
      @pick="onPick"
    />
  </div>
</template>
