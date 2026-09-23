export type PinInputType = 'text' | 'number'

export interface PinInputProps {
  modelValue?: string | string[]
  length?: number
  disabled?: boolean
  invalid?: boolean
  otp?: boolean
  type?: PinInputType
  placeholder?: string
  name?: string
  class?: string
}

export interface PinInputEmits {
  'update:modelValue': [value: string]
  complete: [value: string]
}
