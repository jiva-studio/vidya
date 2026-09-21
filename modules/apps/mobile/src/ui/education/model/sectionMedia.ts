import { isMediaPath } from '@vidya/domain'
import type { LessonBlock } from '@vidya/protocol'

/**
 * What a section refers to, and what those references play at.
 *
 * A block stores `/media/<id>` for a file of the school and a plain link for
 * anything else. Both are looked up the same way, keyed by what the block
 * holds, so a template asks one question per source and never sorts them out
 * itself.
 */
export type MediaAddresses = Readonly<Record<string, string | undefined>>

/** Every source a section draws, deduplicated: one screen is one batch. */
export const listMediaSources = (blocks: readonly LessonBlock[]): string[] => [
  ...new Set(blocks.flatMap(sourcesOf).filter(isPresent)),
]

/** Those of them the school has to issue an address for. */
export const listSchoolFilePaths = (blocks: readonly LessonBlock[]): string[] =>
  listMediaSources(blocks).filter(isMediaPath)

export const resolveAddresses = (
  sources: readonly string[],
  resolve: (source: string) => string | undefined,
): MediaAddresses => Object.fromEntries(sources.map((source) => [source, resolve(source)]))

// A poster is a file of the school like the video it stands in for, so it is
// resolved with it: a section primed without it draws a player with no frame.
const sourcesOf = (block: LessonBlock): (string | undefined)[] => {
  if (block.type === 'video') return [block.url, block.posterUrl]
  if (block.type === 'audio') return [block.url]

  return []
}

const isPresent = (source: string | undefined): source is string => source !== undefined
