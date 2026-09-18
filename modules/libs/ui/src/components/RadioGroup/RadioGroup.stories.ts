import RadioGroup from './RadioGroup.vue'

const options = [
  { value: 'self', label: 'Self-paced', description: 'Students move at their own speed.' },
  { value: 'guided', label: 'Guided', description: 'A teacher opens each lesson.' },
  { value: 'archived', label: 'Archived', disabled: true },
]

export default { title: 'Input/RadioGroup', component: RadioGroup }

export const Default = { args: { options, modelValue: 'self' } }
export const Horizontal = { args: { options, modelValue: 'guided', orientation: 'horizontal' } }
export const Disabled = { args: { options, modelValue: 'self', disabled: true } }
