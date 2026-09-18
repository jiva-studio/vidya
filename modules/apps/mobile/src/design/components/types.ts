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
}

export interface StepsWizardProps {
  currentStep: number
}

export interface WithListHeaderProps {
  title: string
}
