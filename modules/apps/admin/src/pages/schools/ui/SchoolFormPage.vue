<script setup lang="ts">
import { FormFooter, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { reasonOf, useToasts } from '@/shared/lib'
import { useSchoolApi } from '@/entities/school'

import SchoolAboutField from './SchoolAboutField.vue'
import SchoolLogoField from './SchoolLogoField.vue'
import SchoolNameField from './SchoolNameField.vue'
import type { SchoolFormPageProps } from './types'
import { formClasses, pageClasses } from './styles'
import { PageBack } from '@/shared/navigation'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SchoolFormPageProps>(), { id: undefined })

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const toasts = useToasts()
const api = useSchoolApi()

const name = ref('')
const logoUrl = ref('')
const description = ref('')
const busy = ref(false)
const error = ref<string | undefined>(undefined)
const invalid = ref(false)
const badLogo = ref(false)

const title = computed(() =>
  props.id ? $t('schools-form-edit-title') : $t('schools-form-create-title'),
)
const nameError = computed(() => (invalid.value ? $t('schools-form-name-required') : undefined))
const logoError = computed(() => (badLogo.value ? $t('schools-form-logo-invalid') : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void load()
})

/* -------------------------------- Handlers -------------------------------- */

async function onSubmit() {
  invalid.value = name.value.trim().length === 0
  badLogo.value = !isAddressable(logoUrl.value)
  if (invalid.value || badLogo.value) return

  busy.value = true
  error.value = undefined

  try {
    await send()
    toasts.show({ title: $t('toast-saved'), tone: 'success' })
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
    logoUrl.value = school.logoUrl ?? ''
    description.value = school.description ?? ''
  } catch (failure) {
    error.value = reasonOf(failure)
  } finally {
    busy.value = false
  }
}

/**
 * An empty box means the school has no logo, which the wire spells `null`; an
 * empty string would be a logo whose address is nothing.
 */
function filled(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Caught here so a mistyped address comes back as a field error rather than as
// a 400 whose message names a validator.
function isAddressable(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return true

  return URL.canParse(trimmed) && /^https?:$/.test(new URL(trimmed).protocol)
}

async function send(): Promise<void> {
  const body = {
    name: name.value.trim(),
    logoUrl: filled(logoUrl.value),
    description: filled(description.value),
  }

  if (props.id) {
    await api.update(props.id, body)
    return
  }

  await api.create(body)
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="title">
      <template #leading><PageBack /></template>
    </PageHeader>
    <form :class="formClasses" @submit.prevent="onSubmit">
      <SchoolNameField v-model="name" :error="nameError" :disabled="busy" />
      <SchoolLogoField v-model="logoUrl" :error="logoError" :disabled="busy" />
      <SchoolAboutField v-model="description" :disabled="busy" />
      <FormFooter
        :submit-label="$t('action-save')"
        :cancel-label="$t('action-cancel')"
        :busy="busy"
        @submit="onSubmit"
        @cancel="onCancel"
      />
    </form>
  </section>
</template>
