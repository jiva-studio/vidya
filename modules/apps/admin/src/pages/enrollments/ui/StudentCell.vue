<script setup lang="ts">
import { Avatar } from '@vidya/ui'

import { primaryLineClasses, secondaryLineClasses, stackClasses } from './styles'
import type { StudentCellProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<StudentCellProps>()
</script>

<template>
  <div class="flex items-center gap-[var(--space-2)]">
    <Avatar :name="props.name" size="sm" />
    <div :class="stackClasses">
      <span :class="primaryLineClasses">{{ props.name }}</span>
      <span :class="secondaryLineClasses">{{ props.note }}</span>
    </div>
  </div>
</template>
