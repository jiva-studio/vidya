export interface DropzoneProps {
  /** Accept attribute and the refusal check, e.g. `image/*`. */
  accept: string
  label: string
  hint: string
  browseLabel: string
  refusedLabel: string
  disabled?: boolean
  class?: string
}

export interface DropzoneEmits {
  files: [files: File[]]
  refused: [files: File[]]
}

export type DropzoneState = 'idle' | 'dragging' | 'refused'
