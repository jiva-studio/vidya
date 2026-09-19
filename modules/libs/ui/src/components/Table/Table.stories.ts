import Table from './Table.vue'
import TableCell from './TableCell.vue'
import TableRow from './TableRow.vue'

const columns = [
  { key: 'index', label: '#', width: 'var(--col-index)' },
  { key: 'name', label: 'Course' },
  { key: 'type', label: 'Learning type' },
  { key: 'lessons', label: 'Lessons', numeric: true },
]

const rows = [
  { id: '1', index: 1, name: 'Sanskrit grammar', type: 'Guided', lessons: 12 },
  { id: '2', index: 2, name: 'Bhagavad-gita study', type: 'Self-paced', lessons: 18 },
  { id: '3', index: 3, name: 'Kirtan practice', type: 'Guided', lessons: 6 },
]

const render = (args: Record<string, unknown>) => ({
  components: { Table, TableRow, TableCell },
  setup: () => ({ args }),
  template: `
    <Table v-bind="args">
      <template #row="{ row }">
        <TableRow>
          <TableCell align="start" numeric>{{ row.index }}</TableCell>
          <TableCell tone="primary" nowrap>{{ row.name }}</TableCell>
          <TableCell nowrap>{{ row.type }}</TableCell>
          <TableCell numeric>{{ row.lessons }}</TableCell>
        </TableRow>
      </template>
    </Table>
  `,
})

export default { title: 'Design system/Data/Table', component: Table }

export const Default = { render, args: { columns, rows, caption: 'Courses' } }
export const Loading = { render, args: { columns, rows: [], loading: true } }
export const Empty = {
  render,
  args: {
    columns,
    rows: [],
    emptyTitle: 'No courses yet',
    emptyDescription: 'A course holds the lessons students work through. Create the first one.',
    emptyActionLabel: 'Create course',
  },
}
export const Failed = {
  render,
  args: { columns, rows: [], error: 'The server did not answer. The list may be out of date.' },
}
