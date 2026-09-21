export interface ListPageProps {
  title: string
  description?: string

  /** The label of the one action a list page carries; absent hides it. */
  createLabel?: string

  page?: number
  perPage?: number
  total?: number

  /** Drawn only when there is a second page to go to. */
  paged?: boolean
}

export interface ListPageEmits {
  create: []
  'update:page': [page: number]
}
