import Textarea from './Textarea.vue'

export default { title: 'Design system/Forms/Textarea', component: Textarea }

export const Default = { args: { placeholder: 'What this course covers' } }
export const Filled = { args: { modelValue: 'Six weeks of grammar and recitation.' } }
export const Invalid = { args: { modelValue: '', invalid: true } }
export const Disabled = { args: { modelValue: 'Locked', disabled: true } }
