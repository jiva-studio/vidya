export interface AsyncButtonProps {
  busy: boolean
  disabled?: boolean
  errorCode?: string
}

export interface AsyncButtonEmits {
  click: []
}

export interface PageToolbarProps {
  title: string
  /** Where the back button leads with no stack behind it; `null` leaves it out. */
  backHref?: string | null
}

/** Minutes from midnight. The picker knows no domain: it offers hours and ends at 1440. */
export interface TimePickerProps {
  startMinute?: number
  endMinute?: number
}

export interface TimePickerEmits {
  confirm: [chosen: { startMinute: number; endMinute: number }]
  cancel: []
}

export interface StepsWizardProps {
  currentStep: number
}

export interface WithListHeaderProps {
  title: string
}
