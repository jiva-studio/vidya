<script setup lang="ts">
import { Skeleton } from '@vidya/ui'

import { LeaveSchoolPanel } from '@/features/leave-school'
import { mutedClasses, sectionClasses } from '@/shared/ui'

import { useMySchools } from '../model'

/* --------------------------------- State ---------------------------------- */

const { rows, reading } = useMySchools()
</script>

<template>
  <section :class="sectionClasses">
    <h2>{{ $t('settings-schools-title') }}</h2>

    <Skeleton v-if="reading" :lines="2" />

    <p v-else-if="rows.length === 0" :class="mutedClasses">{{ $t('settings-schools-none') }}</p>

    <LeaveSchoolPanel
      v-for="row in rows"
      v-else
      :key="row.school.id"
      :school="row.school"
      :places="row.places"
    />
  </section>
</template>
