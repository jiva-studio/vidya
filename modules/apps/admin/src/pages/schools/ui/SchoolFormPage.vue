<script setup lang="ts">
import { FormActions, FormField, Input, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { reasonOf } from '@/shared/lib'
import { useSchoolApi } from '@/entities/school'

import type { SchoolFormPageProps } from './types'
import { formClasses } from './styles'

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
  const body = { name: name.value.trim() }
  if (props.id) {
    await api.update(props.id, body)
    return
  }
  await api.create(body)
}
</script>

<template>
  <PageHeader :title="title" />
  <form :class="formClasses" @submit.prevent="onSubmit">
    <FormField :label="$t('schools-form-name')" :error="nameError" required>
      <template #default="field">
        <Input
          :id="field.id"
          v-model="name"
          name="name"
          :described-by="field.describedBy"
          :invalid="field.invalid"
          :disabled="busy"
        />
      </template>
    </FormField>
    <FormActions
      :submit-label="$t('action-save')"
      :cancel-label="$t('action-cancel')"
      :busy="busy"
      :error="errorText"
      @submit="onSubmit"
      @cancel="onCancel"
    />
  </form>
</template>
