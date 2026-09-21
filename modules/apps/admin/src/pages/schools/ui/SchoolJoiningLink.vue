<script setup lang="ts">
import { Button, FieldGroup, Input } from '@vidya/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useJoiningLink } from '../model'
import { joinLinkClasses, joinNoticeClasses, joinRowClasses, joinStatusClasses } from './styles'
import type { SchoolJoiningLinkProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolJoiningLinkProps>()

/* --------------------------------- State ---------------------------------- */

const joining = useJoiningLink(props.id)

const settings = computed(() => ({ name: 'school-settings', params: { id: props.id } }))

/* -------------------------------- Handlers -------------------------------- */

function onMint() {
  void joining.mint()
}

function onCopy() {
  void joining.copy()
}
</script>

<template>
  <FieldGroup :title="$t('schools-join-title')" :description="$t('schools-join-hint')">
    <div v-if="joining.link.value" :class="joinRowClasses">
      <Input :model-value="joining.link.value" readonly />
      <Button variant="secondary" @click="onCopy">{{ $t('schools-join-copy') }}</Button>
    </div>
    <Button v-else variant="secondary" :busy="joining.busy.value" @click="onMint">
      {{ $t('schools-join-mint') }}
    </Button>
    <p v-if="joining.copied.value" :class="joinStatusClasses" role="status">
      {{ $t('schools-join-copied') }}
    </p>
    <p v-if="joining.missingStudentRole.value" :class="joinNoticeClasses" role="status">
      <span>{{ $t('schools-join-no-student-role') }}</span>
      <RouterLink :to="settings" :class="joinLinkClasses">
        {{ $t('schools-join-open-settings') }}
      </RouterLink>
    </p>
    <p v-if="joining.error.value" :class="joinNoticeClasses" role="status">
      {{ $t(joining.error.value) }}
    </p>
  </FieldGroup>
</template>
