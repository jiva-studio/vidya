import type {
  AudioBlock,
  AudioBlockState,
  QuizBlock,
  QuizBlockState,
  TextBlock,
  VideoBlock,
  VideoBlockState,
} from '@vidya/protocol'

import type { MediaUnavailableReason } from '../../../model/sectionMedia'

/** What the notice says, when a block has no address to play. */
export interface MediaUnavailableNoticeProps {
  reason?: MediaUnavailableReason
}

/**
 * A block and the address its file plays at.
 *
 * `src` is what the school issued for `block.url`, and it is absent until it
 * has: a stored path is durable and unplayable, so a block with no address says
 * why rather than handing a player the path.
 */
export interface AudioSectionBlockProps {
  block: AudioBlock
  state?: AudioBlockState
  src?: string
  unavailableReason?: MediaUnavailableReason
}

export interface AudioSectionBlockEmits {
  change: [state: AudioBlockState]
}

export interface QuizSectionBlockProps {
  block: QuizBlock
  state?: QuizBlockState
}

export interface QuizSectionBlockEmits {
  change: [state: QuizBlockState]
}

export interface TextSectionBlockProps {
  block: TextBlock
}

/** As {@link AudioSectionBlockProps}, with the poster resolved beside the video. */
export interface VideoSectionBlockProps {
  block: VideoBlock
  state?: VideoBlockState
  src?: string
  posterSrc?: string
  unavailableReason?: MediaUnavailableReason
}

export interface VideoSectionBlockEmits {
  change: [state: VideoBlockState]
}
