import Combobox from './Combobox.vue'

const options = [
  { value: 'sanskrit', label: 'Sanskrit grammar' },
  { value: 'gita', label: 'Bhagavad-gita study' },
  { value: 'kirtan', label: 'Kirtan practice' },
]

export default { title: 'Design system/Forms/Combobox', component: Combobox }

export const Default = { args: { options } }
export const Selected = { args: { options, modelValue: 'gita' } }
export const Invalid = { args: { options, invalid: true } }
export const Disabled = { args: { options, disabled: true } }
export const Empty = { args: { options: [], emptyLabel: 'No course matches that search.' } }
