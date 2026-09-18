export interface TableToolbarProps {
  search?: string
  searchPlaceholder?: string
  searchLabel?: string
  // Remote lists are searched on the server; one keystroke is not one request.
  searchDebounce?: number
  filtersApplied?: boolean
  clearLabel?: string
  class?: string
}

export interface TableToolbarEmits {
  'update:search': [value: string]
  clear: []
}
