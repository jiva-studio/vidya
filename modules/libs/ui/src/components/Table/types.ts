export type TableAlign = 'start' | 'end'

export interface TableColumn {
  key: string
  label: string
  align?: TableAlign
  // Figures read as a column only when they are right-aligned and tabular.
  numeric?: boolean
  // A token-sized width for a column whose content has a known, short shape.
  width?: string
}

export type TableRowData = Record<string, unknown>

export interface TableProps {
  columns: TableColumn[]
  rows: TableRowData[]
  rowKey?: string
  caption?: string
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  retryLabel?: string
  class?: string
}

export interface TableEmits {
  retry: []
  'empty-action': []
}

export interface TableHeadProps {
  columns: TableColumn[]
  class?: string
}

export interface TableRowProps {
  interactive?: boolean
  selected?: boolean
  class?: string
}

export interface TableRowEmits {
  select: []
}

export type TableCellTone = 'primary' | 'secondary'

export interface TableCellProps {
  align?: TableAlign
  // The cell that names the row; every other cell is secondary.
  tone?: TableCellTone
  numeric?: boolean
  nowrap?: boolean
  truncate?: boolean
  actions?: boolean
  class?: string
}
