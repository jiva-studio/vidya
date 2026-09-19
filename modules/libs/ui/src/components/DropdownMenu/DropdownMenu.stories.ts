import DropdownMenu from './DropdownMenu.vue'

const items = [
  { value: 'edit', label: 'Edit course' },
  { value: 'lessons', label: 'Open lessons' },
  { value: 'delete', label: 'Delete course', destructive: true, separatorBefore: true },
]

export default { title: 'Design system/Overlays/DropdownMenu', component: DropdownMenu }

export const Default = { args: { items } }
export const WithDisabled = {
  args: {
    items: [
      { value: 'edit', label: 'Edit course' },
      { value: 'publish', label: 'Publish version', disabled: true },
    ],
  },
}
export const Empty = { args: { items: [] } }
