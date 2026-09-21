import type {
  AudioBlock,
  BlockId,
  BlockSource,
  LessonBlock,
  MediaId,
  TextBlock,
  VideoBlock,
} from '@vidya/domain'
import { asId, mediaPath } from '@vidya/domain'

import { aLesson, aLessonVersion, SECTION_ID, seed } from './localScreens'

export * from './localScreens'

/**
 * A lesson whose section holds school files, seeded on the device.
 *
 * The stored path is what the device has; the address is what a player needs,
 * and no seed carries one. The text block is here in every case on purpose: a
 * lesson that is downloaded stays readable whatever happens to its media.
 */

export const LECTURE_ID = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')
export const CHANT_ID = asId<MediaId>('b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091')

export const LECTURE_PATH = mediaPath(LECTURE_ID)
export const CHANT_PATH = mediaPath(CHANT_ID)

export const LECTURE_ADDRESS = `https://cdn.school.example/${LECTURE_ID}/original.mp4?token=abc`
export const CHANT_ADDRESS = `https://cdn.school.example/${CHANT_ID}/original.mp3?token=abc`

export const LESSON_TEXT = 'The vowels come first.'

export interface MediaBlockSeed {
  source?: BlockSource
  url?: string
}

export interface MediaLessonSeed {
  video?: MediaBlockSeed
  audio?: MediaBlockSeed
}

const text: TextBlock = {
  id: asId<BlockId>('blk-text'),
  type: 'text',
  content: LESSON_TEXT,
}

const video = (seedOptions: MediaBlockSeed): VideoBlock => ({
  id: asId<BlockId>('blk-video'),
  type: 'video',
  source: seedOptions.source ?? 'upload',
  url: seedOptions.url ?? LECTURE_PATH,
})

const audio = (seedOptions: MediaBlockSeed): AudioBlock => ({
  id: asId<BlockId>('blk-audio'),
  type: 'audio',
  source: seedOptions.source ?? 'upload',
  url: seedOptions.url ?? CHANT_PATH,
})

export function mediaLesson(blocks: MediaLessonSeed = { video: {} }): void {
  const sectionBlocks: LessonBlock[] = [text]
  if (blocks.video) sectionBlocks.push(video(blocks.video))
  if (blocks.audio) sectionBlocks.push(audio(blocks.audio))

  seed.lessons.push(aLesson())
  seed.versions.push(
    aLessonVersion({
      content: {
        schemaVersion: 1,
        sections: [
          { id: SECTION_ID, title: 'Letters', assessment: 'none', blocks: sectionBlocks },
        ],
      },
    }),
  )
}
