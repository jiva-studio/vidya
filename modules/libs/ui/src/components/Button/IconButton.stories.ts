import { Check, Pencil, Trash2, Users, X } from 'lucide-vue-next'

import IconButton from './IconButton.vue'

const render = (args: Record<string, unknown>) => ({
  components: { IconButton, Pencil },
  setup: () => ({ args }),
  template: '<IconButton v-bind="args"><Pencil /></IconButton>',
})

export default { title: 'Input/IconButton', component: IconButton }

export const Ghost = { render, args: { label: 'Edit' } }
export const Primary = { render, args: { label: 'Edit', variant: 'primary' } }
export const Secondary = { render, args: { label: 'Edit', variant: 'secondary' } }
export const Danger = { render, args: { label: 'Delete', variant: 'danger' } }
export const Busy = { render, args: { label: 'Edit', busy: true } }
export const Disabled = { render, args: { label: 'Edit', disabled: true } }
export const Medium = { render, args: { label: 'Edit', size: 'md' } }
export const Large = { render, args: { label: 'Edit', size: 'lg' } }

export const RowActions = {
  render: () => ({
    components: { IconButton, Check, X, Users, Trash2 },
    template: `
      <div style="display: flex; gap: var(--space-2)">
        <IconButton label="Accept"><Check /></IconButton>
        <IconButton label="Decline" variant="danger"><X /></IconButton>
        <IconButton label="Group"><Users /></IconButton>
        <IconButton label="Delete" variant="danger"><Trash2 /></IconButton>
      </div>
    `,
  }),
}
