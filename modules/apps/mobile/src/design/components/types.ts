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

export interface StepsWizardProps {
  currentStep: number
}

export interface WithListHeaderProps {
  title: string
}
