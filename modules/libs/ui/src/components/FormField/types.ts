export interface FormFieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  class?: string
}

// What the field hands to the control it wraps. The control is dumb: it only
// binds these, and the wiring between label, hint and error lives here.
export interface FormFieldSlotProps {
  id: string
  describedBy: string | undefined
  invalid: boolean
}
