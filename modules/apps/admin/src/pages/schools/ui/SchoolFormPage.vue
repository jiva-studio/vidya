<script setup lang="ts">
import { FormFooter, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { reasonOf } from '@/shared/lib'
import { useSchoolApi } from '@/entities/school'

import SchoolNameField from './SchoolNameField.vue'
import type { SchoolFormPageProps } from './types'
import { formClasses, pageClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SchoolFormPageProps>(), { id: undefined })

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const api = useSchoolApi()

const name = ref('')
const busy = ref(false)
const error = ref<string | undefined>(undefined)
const invalid = ref(false)

const title = computed(() =>
  props.id ? $t('schools-form-edit-title') : $t('schools-form-create-title'),
)
const nameError = computed(() => (invalid.value ? $t('schools-form-name-required') : undefined))
const errorText = computed(() => (error.value ? $t(error.value) : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  invalid.value = name.value.trim().length === 0
  if (invalid.value) return

  busy.value = true
  error.value = undefined

  try {
    await send()
    void router.push({ name: 'schools' })
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

function onCancel() {
  void router.push({ name: 'schools' })
}

/* -------------------------------- Helpers --------------------------------- */

async function load(): Promise<void> {
  const id = props.id
  if (!id) return

  busy.value = true
  try {
    const school = await api.get(id)
    name.value = school.name
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

async function send(): Promise<void> {
  const trimmed = name.value.trim()

  // A patch carries only the name: this form has no editor for the logo or the
  // description, and naming them here would blank whatever is already set.
  if (props.id) {
    await api.update(props.id, { name: trimmed })
    return
  }

  await api.create({ name: trimmed, logoUrl: null, description: null })
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="title" />
    <form :class="formClasses" @submit.prevent="onSubmit">
      <SchoolNameField v-model="name" :error="nameError" :disabled="busy" />
      <FormFooter
        :submit-label="$t('action-save')"
        :cancel-label="$t('action-cancel')"
        :busy="busy"
        :error="errorText"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </form>
  </section>
</template>
