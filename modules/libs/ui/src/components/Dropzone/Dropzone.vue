<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '../Button'
import { cn } from '../../lib/utils'
import { hintClasses, labelClasses, pickerClasses, refusedClasses, zoneVariants } from './styles'
import type { DropzoneEmits, DropzoneProps, DropzoneState } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<DropzoneProps>(), {
  disabled: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<DropzoneEmits>()

/* --------------------------------- State ---------------------------------- */

const zone = ref<HTMLElement | null>(null)
const wasRefused = ref(false)
const picker = ref<HTMLInputElement | null>(null)
const { isOverDropZone } = useDropZone(zone, { onDrop: onDrop, onEnter: onEnter })
const state = computed<DropzoneState>(() => stateOf(isOverDropZone.value, wasRefused.value))

/* -------------------------------- Handlers -------------------------------- */

function onDrop(files: File[] | null) {
  hand(files ?? [])
}

function onEnter() {
  wasRefused.value = false
}

function onBrowse() {
  if (props.disabled) return
  picker.value?.click()
}

function onPicked(event: Event) {
  const input = event.target as HTMLInputElement
  hand([...(input.files ?? [])])
  input.value = ''
}

/* -------------------------------- Helpers --------------------------------- */

function stateOf(dragging: boolean, refused: boolean): DropzoneState {
  if (dragging) return 'dragging'
  return refused ? 'refused' : 'idle'
}

// A drop is one gesture that can carry both kinds at once, so each half is
// reported on its own event rather than the whole drop being judged by its
// first file.
function hand(files: File[]) {
  if (props.disabled) return
  const taken = files.filter((file) => accepts(file))
  const left = files.filter((file) => !accepts(file))
  wasRefused.value = left.length > 0
  if (taken.length > 0) emit('files', taken)
  if (left.length > 0) emit('refused', left)
}

function accepts(file: File): boolean {
  return props.accept
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .some((pattern) => matches(file, pattern))
}

function matches(file: File, pattern: string): boolean {
  if (pattern === '*/*') return true
  if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase())
  if (pattern.endsWith('/*')) return file.type.startsWith(`${pattern.slice(0, -1)}`)
  return file.type === pattern
}
</script>

<template>
  <div
    ref="zone"
    :class="cn(zoneVariants({ state, disabled: props.disabled }), props.class)"
    :aria-disabled="props.disabled || undefined"
  >
    <p :class="labelClasses">{{ props.label }}</p>
    <p :class="hintClasses">{{ props.hint }}</p>
    <p v-if="state === 'refused'" :class="refusedClasses" role="alert">{{ props.refusedLabel }}</p>
    <Button variant="secondary" :disabled="props.disabled" @click="onBrowse">
      {{ props.browseLabel }}
    </Button>
    <input
      ref="picker"
      type="file"
      :accept="props.accept"
      :disabled="props.disabled"
      :aria-label="props.browseLabel"
      :class="pickerClasses"
      @change="onPicked"
    />
  </div>
</template>
