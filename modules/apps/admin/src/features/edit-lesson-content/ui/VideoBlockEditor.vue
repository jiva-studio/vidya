<script setup lang="ts">
import type { BlockSource } from '@vidya/domain'
import { FormField, Input, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { checkBlockUrl } from '../model'
import { sourceOptions } from './sourceOptions'
import { fieldStackClasses } from './styles'
import type { VideoBlockEditorEmits, VideoBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<VideoBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<VideoBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const options = computed(() => sourceOptions(props.block.source, $t))
const problem = computed(() => checkBlockUrl(props.block.source, props.block.url))

/* -------------------------------- Handlers -------------------------------- */

function onSource(source: string) {
  emit('update', { ...props.block, source: source as BlockSource })
}

function onUrl(url: string) {
  emit('update', { ...props.block, url })
}

function onPoster(posterUrl: string) {
  emit('update', { ...props.block, posterUrl })
}
</script>

<template>
  <div :class="fieldStackClasses">
    <FormField :label="$t('editor-source-label')">
      <template #default="field">
        <Select
          :id="field.id"
          :model-value="props.block.source"
          :options="options"
          :disabled="props.frozen"
          @update:model-value="onSource"
        />
      </template>
    </FormField>
    <FormField
      :label="$t('editor-url-label')"
      :hint="$t('editor-url-hint')"
      :error="problem && $t(problem)"
    >
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.block.url"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          :readonly="props.frozen"
          inputmode="url"
          placeholder="https://"
          @update:model-value="onUrl"
        />
      </template>
    </FormField>
    <FormField :label="$t('editor-poster-label')" :hint="$t('editor-poster-hint')">
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.block.posterUrl ?? ''"
          :described-by="field.describedBy"
          :readonly="props.frozen"
          inputmode="url"
          placeholder="https://"
          @update:model-value="onPoster"
        />
      </template>
    </FormField>
  </div>
</template>
