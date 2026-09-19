import Select from './Select.vue'

const options = [
  { value: 'self', label: 'Self-paced' },
  { value: 'guided', label: 'Guided' },
  { value: 'archived', label: 'Archived', disabled: true },
]

export default { title: 'Design system/Forms/Select', component: Select }

export const Default = { args: { options } }
export const Selected = { args: { options, modelValue: 'guided' } }
export const Invalid = { args: { options, invalid: true } }
export const Disabled = { args: { options, disabled: true } }
export const Empty = { args: { options: [], placeholder: 'No learning types configured' } }
