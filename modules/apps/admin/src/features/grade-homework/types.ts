export interface GradeInputProps {
  modelValue?: number
  disabled?: boolean
  invalid?: boolean
  id?: string
  describedBy?: string
}

export interface GradeInputEmits {
  'update:modelValue': [value: number | undefined]
}

export interface ReviewActionsProps {
  grade?: number

  /** Without `homework:grade` the actions are absent, not disabled. */
  canGrade?: boolean

  busy?: boolean
  error?: string

  /** Raised by the keyboard as well as by the button, so the pane owns it. */
  confirming?: boolean
}

export interface ReviewActionsEmits {
  'update:grade': [value: number | undefined]
  'update:confirming': [open: boolean]
  accept: []
  return: []
}
