export type ThumbnailKind = 'image' | 'video' | 'audio'

export interface ThumbnailProps {
  kind: ThumbnailKind

  /** Absent while the source is still resolving, or when the file is gone. */
  src?: string
  alt: string
  selected?: boolean
  class?: string
}
