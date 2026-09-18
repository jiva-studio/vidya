import FormActions from './FormActions.vue'

export default { title: 'Input/FormActions', component: FormActions }

export const Default = { args: {} }
export const Busy = { args: { busy: true } }
export const Disabled = { args: { disabled: true } }
export const Destructive = { args: { destructive: true, submitLabel: 'Delete course' } }
export const WithError = { args: { error: 'The server refused: a course with this name exists.' } }
