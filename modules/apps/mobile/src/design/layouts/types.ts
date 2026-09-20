export interface ImageAndButtonLayoutProps {
  image: string
  action: string
  dangerAction?: string
  dangerActionAlert?: string
}

export interface ImageAndButtonLayoutEmits {
  click: [action: 'normal' | 'danger']
}

export interface PageWithHeaderLayoutProps {
  title: string
  /** Where the back button leads with no stack behind it; `null` leaves it out. */
  backHref?: string | null
  hasPadding?: boolean
  busy?: boolean
  hasData?: boolean
  isEmpty?: boolean
  error?: string
  emptyText?: string
}
