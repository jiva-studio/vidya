export interface TableFiltersProps {
  search?: string
  searchPlaceholder?: string
  searchLabel?: string
  // Remote lists are searched on the server; one keystroke is not one request.
  searchDebounce?: number
  filtersApplied?: boolean
  clearLabel?: string
  class?: string
}

export interface TableFiltersEmits {
  'update:search': [value: string]
  clear: []
}
