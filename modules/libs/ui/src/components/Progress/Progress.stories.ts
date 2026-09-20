import Progress from './Progress.vue'

export default { title: 'Design system/Feedback/Progress', component: Progress }

export const Start = { args: { value: 0, label: 'Uploading' } }
export const Half = { args: { value: 47, label: 'Uploading' } }
export const Complete = { args: { value: 100, label: 'Uploading' } }
export const OutOfRange = { args: { value: 140, label: 'Uploading' } }
