import Button from '../Button'
import TableFilters from './TableFilters.vue'

const render = (args: Record<string, unknown>) => ({
  components: { TableFilters, Button },
  setup: () => ({ args }),
  template: `
    <TableFilters v-bind="args">
      <template #actions><Button size="sm">New course</Button></template>
    </TableFilters>
  `,
})

export default { title: 'Data/TableFilters', component: TableFilters }

export const Default = { render, args: {} }
export const Searching = { render, args: { search: 'sanskrit' } }
export const Filtered = { render, args: { search: 'sanskrit', filtersApplied: true } }
