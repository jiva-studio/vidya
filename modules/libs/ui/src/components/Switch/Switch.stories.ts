import Switch from './Switch.vue'

export default { title: 'Design system/Forms/Switch', component: Switch }

export const Default = { args: { label: 'Accept new enrolments' } }
export const On = { args: { label: 'Accept new enrolments', modelValue: true } }
export const WithDescription = {
  args: { label: 'Accept new enrolments', description: 'Students can apply to this course.' },
}
export const Disabled = { args: { label: 'Accept new enrolments', disabled: true } }
