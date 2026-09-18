<template>
  <slot :name="'item' + props.currentStep.toString()" />
</template>

<script lang="ts" setup>
import type { StepsWizardProps } from './types'

const props = defineProps<StepsWizardProps>()
</script>
