export interface PaginationProps {
  page?: number
  perPage: number
  total: number
  summaryLabel?: string
  previousLabel?: string
  nextLabel?: string
  class?: string
}

export interface PaginationEmits {
  'update:page': [page: number]
}

export interface PaginationListItemData {
  type: 'page' | 'ellipsis'
  value?: number
}

export interface PaginationItemProps {
  item: PaginationListItemData
  class?: string
}
