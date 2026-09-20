import type { MediaKind, MediaRecord, PickedMedia } from '@/entities/media'

/** The three ways a file reaches a block, in the order the dialog offers them. */
export const MediaPickerTabs = ['upload', 'library', 'link'] as const
export type MediaPickerTab = (typeof MediaPickerTabs)[number]

export interface MediaPickerDialogProps {
  open?: boolean
  kind: MediaKind
  accept: string
}

export interface MediaPickerDialogEmits {
  'update:open': [open: boolean]
  pick: [picked: PickedMedia]
}

export interface MediaUploadPanelProps {
  kind: MediaKind
  accept: string
}

export interface MediaUploadPanelEmits {
  pick: [picked: PickedMedia]
}

export interface MediaLibraryPanelProps {
  kind: MediaKind
}

export interface MediaLibraryPanelEmits {
  pick: [picked: PickedMedia]
}

/** A file in the library, with the address it can be shown at — absent when the
 * file did not outlive the session that uploaded it. */
export interface MediaLibraryTileProps {
  record: MediaRecord
  src?: string
}

export interface MediaLibraryTileEmits {
  pick: [record: MediaRecord]
}
