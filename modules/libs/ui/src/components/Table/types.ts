export type TableAlign = 'start' | 'end'

export interface TableColumn {
  key: string
  label: string
  align?: TableAlign
  // Figures read as a column only when they are right-aligned and tabular.
  numeric?: boolean
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

export interface TableCellProps {
  align?: TableAlign
  numeric?: boolean
  muted?: boolean
  strong?: boolean
  class?: string
}
