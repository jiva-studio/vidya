<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

import {
  boundaryClasses,
  boundaryIconClasses,
  boundaryLabelClasses,
  boundaryRuleClasses,
} from './styles'
import type { SectionBoundaryEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionBoundaryEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onAdd() {
  emit('add')
}
</script>

<template>
  <button
    type="button"
    :class="boundaryClasses"
    :aria-label="$t('editor-section-add')"
    @click="onAdd"
  >
    <span :class="boundaryRuleClasses" />
    <span :class="boundaryLabelClasses">
      <Plus :class="boundaryIconClasses" />
      {{ $t('editor-block-section') }}
    </span>
  </button>
</template>
