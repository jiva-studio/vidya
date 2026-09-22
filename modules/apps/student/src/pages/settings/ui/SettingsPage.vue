<script setup lang="ts">
import { Button } from '@vidya/ui'
import { useRouter } from 'vue-router'

import { useConnection } from '@/shared/connection'
import { answerRowClasses, pageClasses, sectionClasses, titleClasses } from '@/shared/ui'

import MySchools from './MySchools.vue'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const { signOut } = useConnection()

/* -------------------------------- Handlers -------------------------------- */

function onSignOut() {
  signOut()
  void router.push('/login')
}
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('settings-title') }}</h1>
    <MySchools />

    <section :class="sectionClasses">
      <h2>{{ $t('settings-account-title') }}</h2>
      <div :class="answerRowClasses">
        <Button variant="secondary" @click="onSignOut">
          {{ $t('settings-sign-out') }}
        </Button>
      </div>
    </section>
  </section>
</template>
