<script setup lang="ts">
import { ChevronDown, LogOut } from 'lucide-vue-next'
import { Avatar } from '@vidya/ui'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

import { LanguageSwitch } from '@/features/switch-language'

import AccountMenuHeader from './AccountMenuHeader.vue'

import {
  dividerClasses,
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
      <ChevronDown :class="iconClasses" />
    </button>

    <div v-if="isOpen" :class="menuClasses" role="menu">
      <AccountMenuHeader :name="props.name" :email="props.email" />
      <div :class="dividerClasses" />
      <div :class="rowClasses">
        <span :class="rowLabelClasses">{{ $t('language-label') }}</span>
        <LanguageSwitch />
      </div>
      <div :class="dividerClasses" />
      <button :class="signOutClasses" type="button" @click="onSignOut">
        <LogOut :class="iconClasses" />
        <span>{{ $t('action-sign-out') }}</span>
      </button>
    </div>
  </div>
</template>
