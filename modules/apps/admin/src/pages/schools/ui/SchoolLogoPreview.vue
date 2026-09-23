<script setup lang="ts">
import { IconButton } from '@vidya/ui'
import { ImageIcon, Pencil, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'

defineOptions({
  name: 'SchoolLogoPreview',
})

interface Props {
  src: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  change: []
  remove: []
}>()

const loadFailed = ref(false)
</script>

<template>
  <div class="w-full flex items-center gap-4 p-3 rounded-lg border border-slate-200 bg-white">
    <div
      v-if="loadFailed || !props.src"
      class="h-16 w-16 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 select-none"
    >
      <ImageIcon class="h-6 w-6 text-slate-400" />
    </div>
    <img
      v-else
      :src="props.src"
      alt="School logo"
      class="h-16 w-16 rounded-md object-cover border border-slate-200 shrink-0"
      @error="loadFailed = true"
    />
    <div class="ml-auto flex items-center gap-1">
      <IconButton
        variant="ghost"
        size="sm"
        data-test="open-picker"
        data-action="pick"
        :label="$t('schools-form-logo-change')"
        :disabled="props.disabled"
        class="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        @click="emit('change')"
      >
        <Pencil class="h-4 w-4" />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        data-test="remove-logo"
        data-action="remove"
        :label="$t('schools-form-logo-remove')"
        :disabled="props.disabled"
        class="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
        @click="emit('remove')"
      >
        <Trash2 class="h-4 w-4" />
      </IconButton>
    </div>
  </div>
</template>
