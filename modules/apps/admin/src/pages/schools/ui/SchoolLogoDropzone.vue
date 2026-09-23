<script setup lang="ts">
import { Upload } from 'lucide-vue-next'

defineOptions({
  name: 'SchoolLogoDropzone',
})

interface Props {
  error?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border-[var(--color-border-strong)] hover:border-slate-400 group"
    :class="[
      props.error ? 'border-rose-300 bg-rose-50/20 hover:bg-rose-50/40' : '',
      props.disabled ? 'opacity-50 pointer-events-none' : '',
    ]"
    data-test="open-picker"
    data-action="pick"
    aria-label="Choose logo"
    :disabled="props.disabled"
    @click="emit('click')"
  >
    <Upload class="h-8 w-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
    <span
      class="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors"
      data-test="choose-logo"
    >
      {{ $t('schools-form-logo-drop') }}
    </span>
    <span class="text-xs text-slate-400">PNG, JPG, WebP, SVG</span>
  </button>
</template>
