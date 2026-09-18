import Table from './Table.vue'
import TableCell from './TableCell.vue'
import TableRow from './TableRow.vue'

const columns = [
  { key: 'name', label: 'Course' },
  { key: 'type', label: 'Learning type' },
  { key: 'lessons', label: 'Lessons', numeric: true },
]

const rows = [
  { id: '1', name: 'Sanskrit grammar', type: 'Guided', lessons: 12 },
  { id: '2', name: 'Bhagavad-gita study', type: 'Self-paced', lessons: 18 },
  { id: '3', name: 'Kirtan practice', type: 'Guided', lessons: 6 },
]

const render = (args: Record<string, unknown>) => ({
  components: { Table, TableRow, TableCell },
  setup: () => ({ args }),
  template: `
    <Table v-bind="args">
      <template #row="{ row }">
        <TableRow>
          <TableCell strong>{{ row.name }}</TableCell>
          <TableCell muted>{{ row.type }}</TableCell>
          <TableCell numeric>{{ row.lessons }}</TableCell>
        </TableRow>
      </template>
    </Table>
  `,
})

export default { title: 'Data/Table', component: Table }

export const Data = { render, args: { columns, rows, caption: 'Courses' } }
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
export const Error = {
  render,
  args: { columns, rows: [], error: 'The server did not answer. The list may be out of date.' },
}
