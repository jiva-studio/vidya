import Input from './Input.vue'

export default { title: 'Input/Input', component: Input }

export const Default = { args: { placeholder: 'Introduction to Sanskrit' } }
export const Filled = { args: { modelValue: 'Introduction to Sanskrit' } }
export const Invalid = { args: { modelValue: '', invalid: true } }
export const Disabled = { args: { modelValue: 'Locked', disabled: true } }
export const ReadOnly = { args: { modelValue: 'Read only', readonly: true } }
