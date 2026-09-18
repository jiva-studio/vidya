import type {
  AudioBlock,
  AudioBlockState,
  QuizBlock,
  QuizBlockState,
  TextBlock,
  VideoBlock,
  VideoBlockState,
} from '@vidya/protocol'

export interface AudioSectionBlockProps {
  block: AudioBlock
  state?: AudioBlockState
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

export interface VideoSectionBlockProps {
  block: VideoBlock
  state?: VideoBlockState
}

export interface VideoSectionBlockEmits {
  change: [state: VideoBlockState]
}
