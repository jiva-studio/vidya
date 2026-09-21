import { LessonContent, MediaId, parseMediaPath } from '@vidya/domain'

/**
 * Every file the content points at, once each however many blocks show it.
 *
 * An address that is not a stored path is left out rather than refused:
 * content may legitimately embed a video nobody uploaded here, and a block
 * naming something that only looks like a path (`/media/`, `/media/../secrets`)
 * names no file at all.
 */
export const mediaIdsIn = (content: LessonContent): MediaId[] => {
  const named = (content?.sections ?? []).flatMap((section) =>
    (section.blocks ?? []).flatMap((block) => {
      const mediaId = 'url' in block ? parseMediaPath(block.url) : undefined

      return mediaId ? [mediaId] : []
    }),
  )

  return [...new Set(named)]
}
