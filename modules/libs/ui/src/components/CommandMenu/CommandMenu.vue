<script setup lang="ts">
import { ListboxContent, ListboxFilter, ListboxRoot } from 'reka-ui'
import { computed } from 'vue'

import CommandMenuItem from './CommandMenuItem.vue'
import { cn } from '../../lib/utils'
import { contentClasses, emptyClasses, filterClasses, rootClasses } from './styles'
import type { CommandItem, CommandMenuEmits, CommandMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CommandMenuProps>(), {
  term: '',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CommandMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const visible = computed(() => matching(props.items, props.term))

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: unknown) {
  if (value === undefined || value === null) return
  emit('select', String(value))
}

function onTerm(term: string) {
  emit('update:term', term)
}

function onEscape() {
  emit('close')
}

/* -------------------------------- Helpers --------------------------------- */

// The label is what the author reads, so it is what they type at; the
// description is prose and would match half the menu on a common word.
function matching(items: CommandItem[], term: string): CommandItem[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => item.label.toLowerCase().includes(needle))
}
</script>

<template>
  <ListboxRoot
    :class="cn(rootClasses, props.class)"
    :aria-label="props.label"
    highlight-on-hover
    @update:model-value="onSelect"
    @keydown.escape="onEscape"
  >
    <ListboxFilter
      :model-value="props.term"
      :class="filterClasses"
      :placeholder="props.placeholder"
      auto-focus
      @update:model-value="onTerm"
    />
    <ListboxContent :class="contentClasses">
      <CommandMenuItem v-for="item in visible" :key="item.value" :item="item" />
      <p v-if="visible.length === 0" :class="emptyClasses">{{ props.emptyLabel }}</p>
    </ListboxContent>
  </ListboxRoot>
</template>
