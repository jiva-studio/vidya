import { LessonBlock, LessonContent, MediaId, parseMediaPath } from '@vidya/domain'

type BlockKind = LessonBlock['type']
type BlockOf<K extends BlockKind> = Extract<LessonBlock, { type: K }>

/** A field an author fills in freely, which is the only kind that can hold an address. */
type AddressFieldsOf<B> = { [K in keyof B]-?: string extends B[K] ? K : never }[keyof B]

/**
 * Which fields of a block hold the address of a stored file.
 *
 * A block carries as many addresses as it has fields for: a video shows its
 * poster from the library as well as the video, and a field left out here is a
 * file nothing counts as used and anything may delete.
 *
 * `as const satisfies` and not a plain annotation: the element types have to
 * stay literal, or the table names every text field of every block and the
 * exhaustiveness the `satisfies` buys holds for a table that classifies nothing.
 */
export const MediaAddressFields = {
  text: [],
  image: ['url'],
  video: ['url', 'posterUrl'],
  audio: ['url'],
  quiz: [],
} as const satisfies { [K in BlockKind]: readonly AddressFieldsOf<BlockOf<K>>[] }

/**
 * Every file the content points at, once each however many addresses of however
 * many blocks show it.
 *
 * An address that is not a stored path is left out rather than refused:
 * content may legitimately embed a video nobody uploaded here, and a block
 * naming something that only looks like a path (`/media/`, `/media/../secrets`)
 * names no file at all.
 */
export const mediaIdsIn = (content: LessonContent): MediaId[] => {
  const named = (content?.sections ?? []).flatMap((section) =>
    (section.blocks ?? []).flatMap((block) => {
      const fields: readonly string[] = MediaAddressFields[block.type]

      return fields.flatMap((field) => {
        const address = (block as Record<string, unknown>)[field]
        const mediaId = typeof address === 'string' ? parseMediaPath(address) : undefined

        return mediaId ? [mediaId] : []
      })
    }),
  )

  return [...new Set(named)]
}
