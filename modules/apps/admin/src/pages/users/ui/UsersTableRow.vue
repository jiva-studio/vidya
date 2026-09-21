<script setup lang="ts">
import { Avatar, Badge, IconButton, TableCell, TableRow } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { ArrowRight } from 'lucide-vue-next'
import { computed } from 'vue'

import { rolesClasses } from './styles'
import type { UsersTableRowEmits, UsersTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UsersTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<UsersTableRowEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// `users.name` is nullable in the schema, so a row with nobody's name in it is
// ordinary; an empty cell reads as a broken row rather than as a gap to fill.
const name = computed(() => props.user.name?.trim() || $t('users-unnamed'))

// Somebody listed with no role at all is a person whose access was taken away
// but whose account stayed; the dash says so rather than leaving a blank.
const roles = computed(() => props.user.roles ?? [])

/* -------------------------------- Handlers -------------------------------- */

function onOpen() {
  emit('open', props.user.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="name">
      <div class="inline-flex items-center gap-[var(--space-2)]">
        <Avatar :name="props.user.name" size="sm" />
        <span class="truncate">{{ name }}</span>
      </div>
    </TableCell>
    <TableCell>
      <div :class="rolesClasses">
        <Badge v-for="role in roles" :key="role.id">{{ role.name }}</Badge>
        <span v-if="roles.length === 0">—</span>
      </div>
    </TableCell>
    <TableCell actions>
      <IconButton :label="$t('users-open')" @click="onOpen">
        <ArrowRight />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
