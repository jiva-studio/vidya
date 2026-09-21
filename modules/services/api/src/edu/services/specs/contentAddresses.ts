import { faker } from '@faker-js/faker'
import * as domain from '@vidya/domain'
import { LessonBlock, LessonContent, MediaId, parseMediaPath } from '@vidya/domain'

import { MediaAddressFields } from '../mediaInContent'

type BlockKind = LessonBlock['type']
type BlockOf<K extends BlockKind> = Extract<LessonBlock, { type: K }>

/**
 * The fields of a block that carry free text — an address or prose alike. A
 * literal field such as `type` or a union such as `source` is not one: nothing
 * an author types ever lands there.
 */
type TextFieldsOf<B> = { [K in keyof B]-?: string extends B[K] ? K : never }[keyof B]

type FieldsByKind = { [K in BlockKind]: readonly TextFieldsOf<BlockOf<K>>[] }

/**
 * The fields whose value is a stored path, as the extractor itself declares
 * them. Read from there rather than copied: a table of its own would agree with
 * the extractor about nothing, and the point is that there is one of them.
 */
export const ADDRESS_FIELDS = MediaAddressFields

/** The fields whose value is shown to a student as words, and names no file. */
export const PROSE_FIELDS = {
  text: ['content'],
  image: ['caption'],
  video: ['caption'],
  audio: ['caption'],
  quiz: ['question', 'explanation'],
} as const satisfies FieldsByKind

type Unclassified<K extends BlockKind> = Exclude<
  TextFieldsOf<BlockOf<K>>,
  (typeof ADDRESS_FIELDS)[K][number] | (typeof PROSE_FIELDS)[K][number]
>

/**
 * Proves the extractor's table kept its literal element types: declared any
 * wider, it would name every text field and the check below would hold for a
 * table that classifies nothing.
 */
type ProseIsNotAnAddress =
  Exclude<'caption', (typeof ADDRESS_FIELDS)['video'][number]> extends 'caption' ? true : false

export const proseIsNotAnAddress: ProseIsNotAnAddress = true

/**
 * Refuses to compile once a block type grows a text field neither table names,
 * so a field added to `LessonBlock` cannot reach content without someone saying
 * whether it addresses a file.
 */
type EveryTextFieldClassified = {
  [K in BlockKind]: Unclassified<K> extends never ? true : never
}

export const everyTextFieldClassified: EveryTextFieldClassified = {
  text: true,
  image: true,
  video: true,
  audio: true,
  quiz: true,
}

export const blockKinds = Object.keys(ADDRESS_FIELDS) as BlockKind[]

const blockId = () => domain.asId<domain.BlockId>(faker.string.uuid())
const sectionId = () => domain.asId<domain.SectionId>(faker.string.uuid())

/**
 * One block of each kind with nothing filled in. Adding a required field to a
 * block type stops this compiling, which is what keeps the tables above honest
 * about types rather than about the fields someone remembered.
 */
const bareBlocks = (): { [K in BlockKind]: BlockOf<K> } => ({
  text: { id: blockId(), type: 'text', content: '' },
  image: { id: blockId(), type: 'image', source: 'upload', url: '' },
  video: { id: blockId(), type: 'video', source: 'upload', url: '' },
  audio: { id: blockId(), type: 'audio', source: 'upload', url: '' },
  quiz: { id: blockId(), type: 'quiz', question: '', answers: ['yes', 'no'], rightAnswer: 0 },
})

/** A block of the given kind with the same value written into each named field. */
export const blockWithText = (
  kind: BlockKind,
  fields: readonly string[],
  value: string,
): LessonBlock => {
  const block = bareBlocks()[kind] as Record<string, unknown>
  for (const field of fields) block[field] = value

  return block as unknown as LessonBlock
}

export const contentOf = (blocks: LessonBlock[]): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [{ id: sectionId(), title: 'Material', assessment: 'none', blocks }],
})

/**
 * The files content names, read off the address tables rather than off the
 * production extractor: a scan that shares the extractor's enumeration agrees
 * with it about the fields it forgot.
 */
export const addressedMediaIdsIn = (content: LessonContent): MediaId[] => {
  const named = (content?.sections ?? []).flatMap((section) =>
    (section.blocks ?? []).flatMap((block) => {
      const fields: readonly string[] = ADDRESS_FIELDS[block.type]
      const values = fields.map((field) => (block as Record<string, unknown>)[field])

      return values.flatMap((value) => {
        const mediaId = typeof value === 'string' ? parseMediaPath(value) : undefined

        return mediaId ? [mediaId] : []
      })
    }),
  )

  return [...new Set(named)]
}
