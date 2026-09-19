export interface BreadcrumbItem {
  key: string
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  label?: string
  class?: string
}

export interface BreadcrumbsEmits {
  select: [key: string]
}
