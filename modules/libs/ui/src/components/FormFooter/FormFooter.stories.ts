import FormFooter from './FormFooter.vue'

export default { title: 'Design system/Forms/FormFooter', component: FormFooter }

export const Default = { args: {} }
export const Busy = { args: { busy: true } }
export const Disabled = { args: { disabled: true } }
export const Destructive = { args: { destructive: true, submitLabel: 'Delete course' } }
export const WithError = { args: { error: 'The server refused: a course with this name exists.' } }
