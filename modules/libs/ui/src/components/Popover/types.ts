export type PopoverSide = 'top' | 'right' | 'bottom' | 'left'
export type PopoverAlign = 'start' | 'center' | 'end'

export interface PopoverProps {
  open?: boolean
  side?: PopoverSide
  align?: PopoverAlign

  /** Named for assistive technology, which sees a panel with no visible title. */
  label: string
  class?: string
}

export interface PopoverEmits {
  'update:open': [open: boolean]
}
