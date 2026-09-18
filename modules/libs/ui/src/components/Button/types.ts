export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  busy?: boolean
  busyLabel?: string
  fullWidth?: boolean
  class?: string
}

export interface ButtonEmits {
  click: [event: MouseEvent]
}
