<script setup lang="ts">
import type { Locale } from '@/shared/i18n'
import { locale, Locales } from '@/shared/i18n'

import { currentClasses, optionClasses, switchClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

// Two languages, both named in their own: "Русский" is the same word to a
// reader of either bundle, so the label is not itself translated.
const labels: Record<Locale, string> = { ru: 'Русский', en: 'English' }

/* -------------------------------- Handlers -------------------------------- */

function onChoose(next: Locale) {
  locale.value = next
}

/* -------------------------------- Helpers --------------------------------- */

function classesFor(candidate: Locale): string[] {
  return candidate === locale.value ? currentClasses : optionClasses
}
</script>

<template>
  <div :class="switchClasses" role="group" :aria-label="$t('language-label')">
    <button
      v-for="candidate in Locales"
      :key="candidate"
      type="button"
      :class="classesFor(candidate)"
      :aria-pressed="candidate === locale"
      @click="onChoose(candidate)"
    >
      {{ labels[candidate] }}
    </button>
  </div>
</template>
