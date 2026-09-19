<script setup lang="ts">
import { unknownClasses } from './styles'
import type { UnknownBlockNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UnknownBlockNoticeProps>()
</script>

<template>
  <div :class="unknownClasses" role="note">
    <strong>{{ $t('editor-block-unknown-title', { type: props.type }) }}</strong>
    <span>{{ $t('editor-block-unknown-body') }}</span>
  </div>
</template>
