import Button from '../Button'
import TableToolbar from './TableToolbar.vue'

const render = (args: Record<string, unknown>) => ({
  components: { TableToolbar, Button },
  setup: () => ({ args }),
  template: `
    <TableToolbar v-bind="args">
      <template #actions><Button size="sm">New course</Button></template>
    </TableToolbar>
  `,
})

export default { title: 'Data/TableToolbar', component: TableToolbar }

export const Default = { render, args: {} }
export const Searching = { render, args: { search: 'sanskrit' } }
export const Filtered = { render, args: { search: 'sanskrit', filtersApplied: true } }
