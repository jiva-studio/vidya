import type { BlockSource } from '@vidya/domain'

import type { MediaKind, MediaRecord, PickedMedia } from '@/entities/media'

/** The three ways a file reaches a block, in the order the dialog offers them. */
export const MediaPickerTabs = ['upload', 'library', 'link'] as const
export type MediaPickerTab = (typeof MediaPickerTabs)[number]

export interface MediaPickerDialogProps {
  open?: boolean
  kind: MediaKind
  accept: string

  /** The link being typed, and what the block's own rules make of it. */
  link?: string
  source?: BlockSource
}

export interface MediaPickerDialogEmits {
  'update:open': [open: boolean]
  'update:link': [link: string]
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

export interface MediaLinkPanelProps {
  link: string
  source?: BlockSource
}

export interface MediaLinkPanelEmits {
  'update:link': [link: string]
  submit: []
}

export interface MediaLibraryTileProps {
  record: MediaRecord

  /** Absent when the file did not outlive the session that uploaded it. */
  src?: string
}

export interface MediaLibraryTileEmits {
  pick: [record: MediaRecord]
}
