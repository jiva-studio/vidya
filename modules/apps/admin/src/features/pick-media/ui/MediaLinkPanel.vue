<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { panelClasses } from './styles'
import type { MediaLinkPanelEmits, MediaLinkPanelProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaLinkPanelProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaLinkPanelEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// The rules a link is judged by live with the block, so the panel only reports
// the verdict it was handed and never guesses at one of its own.
const touched = ref(false)
const problem = computed(() => (touched.value && !props.source ? 'url-malformed' : undefined))

/* -------------------------------- Handlers -------------------------------- */

function onLink(value: string) {
  touched.value = false
  emit('update:link', value)
}

function onSubmit() {
  touched.value = true
  if (props.source) emit('submit')
}
</script>

<template>
  <div :class="panelClasses">
    <FormField
      :label="$t('media-picker-link-label')"
      :hint="$t('media-picker-link-hint')"
      :error="problem && $t(problem)"
    >
      <template #default="field">
        <Input
          :id="field.id"
          :model-value="props.link"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          inputmode="url"
          placeholder="https://"
          @update:model-value="onLink"
        />
      </template>
    </FormField>
    <Button variant="secondary" @click="onSubmit">{{ $t('media-picker-link-submit') }}</Button>
  </div>
</template>
