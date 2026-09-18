import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Table from './Table.vue'
import TableCell from './TableCell.vue'
import TableRow from './TableRow.vue'

const columns = [
  { key: 'name', label: 'Course' },
  { key: 'lessons', label: 'Lessons', numeric: true },
]

const rows = [
  { id: '1', name: 'Sanskrit grammar', lessons: 12 },
  { id: '2', name: 'Kirtan practice', lessons: 6 },
]

const rowSlot = `
  <TableRow>
    <TableCell>{{ params.row.name }}</TableCell>
    <TableCell numeric>{{ params.row.lessons }}</TableCell>
  </TableRow>
`

function mountTable(props: Record<string, unknown>) {
  return mount(Table, {
    props: { columns, rows, ...props },
    slots: { row: rowSlot },
    global: { components: { TableRow, TableCell } },
  })
}

describe('Table', () => {
  it('gives a column the width it declares', () => {
    const wrapper = mountTable({
      columns: [{ key: 'name', label: 'Course', width: 'var(--col-index)' }, columns[1]],
    })

    expect(wrapper.get('colgroup col').attributes('style')).toContain('var(--col-index)')
    expect(wrapper.get('th').attributes('style')).toContain('var(--col-index)')
  })

  it('keeps a row action in the middle of its row', () => {
    const wrapper = mount(TableCell, { props: { actions: true }, slots: { default: 'x' } })

    expect(wrapper.get('td').classes()).toContain('align-middle')
    expect(wrapper.get('td div').classes()).toContain('items-center')
  })

  it('renders a row per record', () => {
    const wrapper = mountTable({})

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Sanskrit grammar')
  })

  it('renders an empty state instead of an empty table', () => {
    const wrapper = mountTable({
      rows: [],
      emptyTitle: 'No courses yet',
      emptyDescription: 'Create the first one.',
      emptyActionLabel: 'Create course',
    })

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('No courses yet')
    expect(wrapper.text()).toContain('Create the first one.')
    expect(wrapper.text()).toContain('Create course')
  })

  it('offers the next step from the empty state', async () => {
    const wrapper = mountTable({ rows: [], emptyActionLabel: 'Create course' })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('empty-action')).toHaveLength(1)
  })

  it('shows the reason and a retry when the load failed', async () => {
    const wrapper = mountTable({ rows: [], error: 'The school was not found.' })

    expect(wrapper.get('[role="alert"]').text()).toContain('The school was not found.')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('shows a busy placeholder while loading, not an empty state', () => {
    const wrapper = mountTable({ rows: [], loading: true })

    expect(wrapper.find('[role="status"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
