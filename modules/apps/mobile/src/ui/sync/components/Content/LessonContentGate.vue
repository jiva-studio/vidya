<template>
  <slot v-if="isSupported" />
  <UnsupportedSchemaNotice
    v-else
    :content-schema-version="contentSchemaVersion"
    :supported-schema-version="supported"
    @update-app="onUpdateApp"
  />
</template>

<script lang="ts" setup>
import { LessonContentSchemaVersion } from '@vidya/domain'
import { computed } from 'vue'

import UnsupportedSchemaNotice from './UnsupportedSchemaNotice.vue'
import type { LessonContentGateEmits, LessonContentGateProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// Content of an unknown shape is kept whole on the device; the screen simply
// declines to draw what it cannot read and asks for a newer app instead.
const props = withDefaults(defineProps<LessonContentGateProps>(), {
  supportedSchemaVersion: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonContentGateEmits>()

/* --------------------------------- State ---------------------------------- */

const supported = computed(() => props.supportedSchemaVersion ?? LessonContentSchemaVersion)
const isSupported = computed(() => props.contentSchemaVersion <= supported.value)

/* -------------------------------- Handlers -------------------------------- */

function onUpdateApp() {
  emit('update-app')
}
</script>
