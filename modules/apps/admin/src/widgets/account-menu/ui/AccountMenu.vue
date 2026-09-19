<script setup lang="ts">
import { Avatar } from '@vidya/ui'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

import { LanguageSwitch } from '@/features/switch-language'

import {
  dividerClasses,
  headerClasses,
  headerEmailClasses,
  headerNameClasses,
  iconClasses,
  menuClasses,
  nameClasses,
  rowClasses,
  rowLabelClasses,
  signOutClasses,
  triggerClasses,
  wrapperClasses,
} from './styles'
import type { AccountMenuEmits, AccountMenuProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<AccountMenuProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<AccountMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const isOpen = ref(false)
const target = ref<HTMLElement | null>(null)

onClickOutside(target, () => {
  isOpen.value = false
})

/* -------------------------------- Handlers -------------------------------- */

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function onSignOut() {
  isOpen.value = false
  emit('sign-out')
}
</script>

<template>
  <div ref="target" :class="wrapperClasses">
    <button
      type="button"
      :class="triggerClasses"
      :aria-expanded="isOpen"
      :aria-label="$t('account-menu-label')"
      @click="toggleMenu"
    >
      <Avatar :name="props.name" size="sm" />
      <span :class="nameClasses">{{ props.name }}</span>
      <svg
        :class="iconClasses"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path v-if="isOpen" d="m18 15-6-6-6 6" />
        <path v-else d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="isOpen" :class="menuClasses" role="menu">
      <div :class="headerClasses">
        <p :class="headerNameClasses">{{ props.name }}</p>
        <p v-if="props.email && props.email !== props.name" :class="headerEmailClasses">
          {{ props.email }}
        </p>
      </div>
      <div :class="dividerClasses" />
      <div :class="rowClasses">
        <span :class="rowLabelClasses">{{ $t('language-label') }}</span>
        <LanguageSwitch />
      </div>
      <div :class="dividerClasses" />
      <button :class="signOutClasses" type="button" @click="onSignOut">
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{{ $t('action-sign-out') }}</span>
      </button>
    </div>
  </div>
</template>
