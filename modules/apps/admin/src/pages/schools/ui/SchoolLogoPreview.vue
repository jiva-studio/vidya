<script setup lang="ts">
import { Button } from '@vidya/ui'

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
</script>

<template>
  <div class="flex items-center gap-4">
    <img
      :src="props.src"
      alt="School logo"
      class="h-16 w-16 rounded-md object-cover border border-slate-200"
    />
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-test="open-picker"
      data-action="pick"
      aria-label="Change logo"
      :disabled="props.disabled"
      @click="emit('change')"
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
      @click="emit('remove')"
    >
      {{ $t('schools-form-logo-remove') }}
    </Button>
  </div>
</template>
