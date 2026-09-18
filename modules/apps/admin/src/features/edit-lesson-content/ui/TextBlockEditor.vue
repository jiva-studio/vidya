<script setup lang="ts">
import { FormField, Textarea } from '@vidya/ui'

import type { TextBlockEditorEmits, TextBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TextBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TextBlockEditorEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onContent(content: string) {
  emit('update', { ...props.block, content })
}
</script>

<template>
  <FormField :label="$t('editor-text-label')" :hint="$t('editor-text-hint')">
    <template #default="field">
      <Textarea
        :id="field.id"
        :model-value="props.block.content"
        :described-by="field.describedBy"
        :readonly="props.frozen"
        :rows="8"
        :placeholder="$t('editor-text-placeholder')"
        @update:model-value="onContent"
      />
    </template>
  </FormField>
</template>
