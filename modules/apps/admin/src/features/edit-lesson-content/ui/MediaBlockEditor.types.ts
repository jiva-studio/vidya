import type { AudioBlock, BlockSource, ImageBlock, VideoBlock } from '@vidya/domain'

import type { MediaKind } from '@/entities/media'

/**
 * The three blocks that hold a file. They differ in what they accept and in
 * what plays them, and in nothing else, so one editor serves all three.
 *
 * These shapes live beside the component rather than in the slice's shared
 * `types.ts` only while the editor is being written by two agents at once.
 */
export type MediaBlock = ImageBlock | VideoBlock | AudioBlock

interface Frozen {
  frozen?: boolean
}

export interface MediaBlockEditorProps extends Frozen {
  block: MediaBlock
  kind: MediaKind
}

export interface MediaBlockEditorEmits {
  update: [block: MediaBlock]
}

export interface MediaBlockEditorEmptyProps extends Frozen {
  kind: MediaKind
  accept: string

  /** The link being typed into the block, and what the model makes of it. */
  link: string
  source?: BlockSource
}

export interface MediaBlockEditorEmptyEmits {
  files: [files: File[]]
  refused: []
  library: []
  'update:link': [link: string]
  submit: []
}

export interface MediaBlockEditorFilledProps extends Frozen {
  block: MediaBlock
  kind: MediaKind

  /** What a player may load, or nothing when the file did not outlive its session. */
  src?: string
}

export interface MediaBlockEditorFilledEmits {
  caption: [caption: string]
  replace: []
}

export interface MediaBlockEditorProgressProps {
  percent: number
}

export interface MediaBlockEditorProgressEmits {
  cancel: []
}

export interface MediaBlockEditorNoticeProps {
  message: string
  retryLabel?: string
}

export interface MediaBlockEditorNoticeEmits {
  retry: []
}

export interface ImageBlockEditorProps extends Frozen {
  block: ImageBlock
}

export interface ImageBlockEditorEmits {
  update: [block: ImageBlock]
}
