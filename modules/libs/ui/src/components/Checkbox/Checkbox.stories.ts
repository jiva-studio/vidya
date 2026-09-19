import Checkbox from './Checkbox.vue'

export default { title: 'Design system/Forms/Checkbox', component: Checkbox }

export const Default = { args: { label: 'courses:create' } }
export const Checked = { args: { label: 'courses:create', modelValue: true } }
export const WithDescription = {
  args: { label: 'courses:create', description: 'Lets the holder open a new course.' },
}
export const Indeterminate = { args: { label: 'All course rights', indeterminate: true } }
export const Disabled = { args: { label: 'courses:create', disabled: true } }
